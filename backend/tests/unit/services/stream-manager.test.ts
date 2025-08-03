import * as streamManager from '../../../src/services/stream-manager';
import {RedisService} from '../../../src/services/redis-service';
import {Response} from 'express';
import {TestResult, TestStatus, StepStatus} from '../../../src/models/test-result';
import {createLogger} from '../../../src/utils/logger';

// Mock dependencies
jest.mock('../../../src/services/redis-service');
jest.mock('../../../src/utils/logger', () => ({
    createLogger: jest.fn().mockReturnValue({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));

describe('StreamManager', () => {
    let mockRedisService: jest.Mocked<RedisService>;
    let mockResponse: jest.Mocked<Response>;

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Create mock Redis service
        mockRedisService = {
            saveTestResult: jest.fn().mockResolvedValue(undefined)
        } as unknown as jest.Mocked<RedisService>;

        // Create mock Express Response
        mockResponse = {
            write: jest.fn(),
            end: jest.fn()
        } as unknown as jest.Mocked<Response>;

        // Reset the module state by re-importing the module
        jest.resetModules();
    });

    describe('addClient', () => {
        it('should add a client for a specific run ID', () => {
            const runId = 'test-run-123';

            streamManager.addClient(runId, mockResponse);

            // Verify behavior by sending data to the client
            streamManager.notifyClients(runId, {test: 'data'});

            expect(mockResponse.write).toHaveBeenCalledWith(`data: ${JSON.stringify({test: 'data'})}\n\n`);
        });

        it('should add multiple clients for the same run ID', () => {
            const runId = 'test-run-123';
            const mockResponse2 = {
                write: jest.fn(),
                end: jest.fn()
            } as unknown as Response;

            streamManager.addClient(runId, mockResponse);
            streamManager.addClient(runId, mockResponse2);

            // Verify behavior by sending data to both clients
            streamManager.notifyClients(runId, {test: 'data'});

            expect(mockResponse.write).toHaveBeenCalledWith(`data: ${JSON.stringify({test: 'data'})}\n\n`);
            expect(mockResponse2.write).toHaveBeenCalledWith(`data: ${JSON.stringify({test: 'data'})}\n\n`);
        });
    });

    describe('notifyClients', () => {
        it('should send data to all clients subscribed to a run ID', () => {
            const runId = 'test-run-123';
            const data = {status: 'running', progress: 50};

            // Add a client
            streamManager.addClient(runId, mockResponse);

            // Notify clients
            streamManager.notifyClients(runId, data);

            expect(mockResponse.write).toHaveBeenCalledWith(`data: ${JSON.stringify(data)}\n\n`);
            expect(mockResponse.end).not.toHaveBeenCalled();
        });

        it('should send data to multiple clients subscribed to the same run ID', () => {
            const runId = 'test-run-123';
            const data = {status: 'running', progress: 50};
            const mockResponse2 = {
                write: jest.fn(),
                end: jest.fn()
            } as unknown as Response;

            // Add clients
            streamManager.addClient(runId, mockResponse);
            streamManager.addClient(runId, mockResponse2);

            // Notify clients
            streamManager.notifyClients(runId, data);

            expect(mockResponse.write).toHaveBeenCalledWith(`data: ${JSON.stringify(data)}\n\n`);
            expect(mockResponse2.write).toHaveBeenCalledWith(`data: ${JSON.stringify(data)}\n\n`);
        });

        it('should do nothing if no clients are subscribed to the run ID', () => {
            const runId = 'test-run-123';
            const data = {status: 'running', progress: 50};

            // Notify clients without adding any
            streamManager.notifyClients(runId, data);

            expect(mockResponse.write).not.toHaveBeenCalled();
        });

        it('should end connections and remove clients when end=true', () => {
            const runId = 'test-run-123';
            const data = {status: 'completed', progress: 100};

            // Add a client
            streamManager.addClient(runId, mockResponse);

            // Notify clients with end=true
            streamManager.notifyClients(runId, data, true);

            // Verify the client was notified and connection was ended
            expect(mockResponse.write).toHaveBeenCalledWith(`data: ${JSON.stringify(data)}\n\n`);
            expect(mockResponse.end).toHaveBeenCalled();

            // Verify the client was removed by trying to notify it again
            // Reset the mocks first
            mockResponse.write.mockClear();
            mockResponse.end.mockClear();

            // Try to notify the client again
            streamManager.notifyClients(runId, {test: 'more data'});

            // Verify the client was not notified
            expect(mockResponse.write).not.toHaveBeenCalled();
        });
    });

    describe('finalizeRunIfNeeded', () => {
        let testRun: TestResult;

        beforeEach(() => {
            // Create a test run in RUNNING state
            testRun = {
                id: 'run-123',
                runId: 'run-123',
                testId: 'test-123',
                status: TestStatus.RUNNING,
                startTime: new Date(),
                endTime: new Date(),
                stepResults: [
                    {
                        stepId: 'step-1',
                        status: StepStatus.PASSED,
                        startTime: new Date(),
                        endTime: new Date(),
                        logs: [],
                        screenshots: []
                    },
                    {
                        stepId: 'step-2',
                        status: StepStatus.PASSED,
                        startTime: new Date(),
                        endTime: new Date(),
                        logs: [],
                        screenshots: []
                    }
                ],
                summary: {
                    totalSteps: 2,
                    passedSteps: 2,
                    failedSteps: 0,
                    skippedSteps: 0,
                    errorSteps: 0,
                    duration: 1000
                }
            };
        });

        it('should not finalize a run that is already in a final state', async () => {
            // Set run to a final state
            testRun.status = TestStatus.PASSED;

            const result = await streamManager.finalizeRunIfNeeded(testRun, mockRedisService);

            expect(result).toBe(false);
            expect(mockRedisService.saveTestResult).not.toHaveBeenCalled();
        });

        it('should not finalize a run that has pending or running steps', async () => {
            // Set one step to running
            testRun.stepResults[1].status = StepStatus.RUNNING;

            const result = await streamManager.finalizeRunIfNeeded(testRun, mockRedisService);

            expect(result).toBe(false);
            expect(mockRedisService.saveTestResult).not.toHaveBeenCalled();
        });

        it('should finalize a run as PASSED when all steps passed', async () => {
            // All steps are already PASSED in the setup

            const result = await streamManager.finalizeRunIfNeeded(testRun, mockRedisService);

            expect(result).toBe(true);
            expect(testRun.status).toBe(TestStatus.PASSED);
            expect(mockRedisService.saveTestResult).toHaveBeenCalledWith(testRun);
        });

        it('should finalize a run as FAILED when any step failed', async () => {
            // Set one step to failed
            testRun.stepResults[1].status = StepStatus.FAILED;

            const result = await streamManager.finalizeRunIfNeeded(testRun, mockRedisService);

            expect(result).toBe(true);
            expect(testRun.status).toBe(TestStatus.FAILED);
            expect(mockRedisService.saveTestResult).toHaveBeenCalledWith(testRun);
        });

        it('should finalize a run as ERROR when any step had an error', async () => {
            // Set one step to error
            testRun.stepResults[1].status = StepStatus.ERROR;

            const result = await streamManager.finalizeRunIfNeeded(testRun, mockRedisService);

            expect(result).toBe(true);
            expect(testRun.status).toBe(TestStatus.ERROR);
            expect(mockRedisService.saveTestResult).toHaveBeenCalledWith(testRun);
        });

        it('should handle Redis errors when saving the result', async () => {
            // Mock Redis service to throw an error
            const error = new Error('Redis connection failed');
            mockRedisService.saveTestResult.mockRejectedValue(error);

            await expect(streamManager.finalizeRunIfNeeded(testRun, mockRedisService)).rejects.toThrow('Redis connection failed');
        });
    });
});