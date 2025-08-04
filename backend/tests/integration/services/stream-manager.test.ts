import * as streamManager from '../../../src/services/stream-manager';
import {RedisService} from '../../../src/services/redis-service';
import {TestResult, TestStatus, StepStatus} from '../../../src/models/test-result';
import {Response} from 'express';

// Mock RedisService
jest.mock('../../../src/services/redis-service');

describe('StreamManager Integration', () => {
    let redisService: jest.Mocked<RedisService>;
    let mockResponse: Response;
    let testRun: TestResult;
    // Define variables at class level so they're accessible to all tests
    let runIdValue: string;
    let writeMock: jest.Mock;
    let endMock: jest.Mock;

    beforeEach(async () => {
        // Create a mock Redis service
        redisService = {
            getClient: jest.fn(),
            getPublisher: jest.fn(),
            getSubscriber: jest.fn(),
            publish: jest.fn(),
            subscribe: jest.fn(),
            unsubscribe: jest.fn(),
            getTestResult: jest.fn(),
            saveTestResult: jest.fn().mockResolvedValue(undefined),
            close: jest.fn().mockResolvedValue(undefined)
        } as unknown as jest.Mocked<RedisService>;

        // Create a mock Express Response with proper Jest mock methods
        // Use a different approach to ensure mockClear is available
        writeMock = jest.fn().mockImplementation(() => true);
        endMock = jest.fn().mockImplementation(() => mockResponse);

        mockResponse = {
            write: writeMock,
            end: endMock
        } as unknown as Response;

        // Create a test run with a fixed runId to avoid type issues
        runIdValue = `integration-test-run-${Date.now()}`;
        testRun = {
            id: runIdValue,
            runId: runIdValue,
            testId: 'integration-test-id',
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
                    status: StepStatus.RUNNING,
                    startTime: new Date(),
                    endTime: new Date(),
                    logs: [],
                    screenshots: []
                }
            ],
            summary: {
                totalSteps: 2,
                passedSteps: 1,
                failedSteps: 0,
                skippedSteps: 0,
                errorSteps: 0,
                duration: 1000
            }
        };

        // Reset the module state by re-importing the module
        jest.resetModules();
    });

    afterEach(async () => {
        // Reset all mocks
        jest.clearAllMocks();
    });

    describe('Client Management and Notifications', () => {
        it('should add clients and notify them', () => {
            // Use the fixed runIdValue
            const runId = runIdValue;
            const data = {status: 'running', progress: 50};

            // Add a client
            streamManager.addClient(runId, mockResponse);

            // Notify clients
            streamManager.notifyClients(runId, data);

            // Verify the client was notified
            expect(mockResponse.write).toHaveBeenCalledWith(`data: ${JSON.stringify(data)}\n\n`);
        });

        it('should end connections when requested', () => {
            // Use the fixed runIdValue
            const runId = runIdValue;
            const data = {status: 'completed', progress: 100};

            // Add a client
            streamManager.addClient(runId, mockResponse);

            // Notify clients with end=true
            streamManager.notifyClients(runId, data, true);

            // Verify the client connection was ended
            expect(mockResponse.write).toHaveBeenCalledWith(`data: ${JSON.stringify(data)}\n\n`);
            expect(mockResponse.end).toHaveBeenCalled();

            // Verify the client was removed by trying to notify it again
            // Reset the mocks first
            writeMock.mockClear();
            endMock.mockClear();

            // Try to notify the client again
            streamManager.notifyClients(runId, {test: 'more data'});

            // Verify the client was not notified
            expect(mockResponse.write).not.toHaveBeenCalled();
        });
    });

    describe('Run Finalization', () => {
        it('should not finalize a run with running steps', async () => {
            // One step is already in RUNNING state in the setup

            // Setup mock for saveTestResult
            redisService.saveTestResult.mockResolvedValue(undefined);

            // Try to finalize the run
            const result = await streamManager.finalizeRunIfNeeded(testRun, redisService);

            // Verify the run was not finalized
            expect(result).toBe(false);
            expect(testRun.status).toBe(TestStatus.RUNNING);

            // Verify saveTestResult was not called since no changes were made
            expect(redisService.saveTestResult).not.toHaveBeenCalled();
        });

        it('should finalize a run when all steps are completed', async () => {
            // Set all steps to completed states
            testRun.stepResults[0].status = StepStatus.PASSED;
            testRun.stepResults[1].status = StepStatus.PASSED;

            // Update summary (using non-null assertion)
            testRun.summary!.passedSteps = 2;

            // Setup mocks
            redisService.saveTestResult.mockResolvedValue(undefined);
            redisService.getTestResult.mockImplementation(async (id) => {
                // Return a copy of testRun with updated status
                return {...testRun, status: TestStatus.PASSED};
            });

            // Finalize the run
            const result = await streamManager.finalizeRunIfNeeded(testRun, redisService);

            // Verify the run was finalized
            expect(result).toBe(true);
            expect(testRun.status).toBe(TestStatus.PASSED);

            // Verify saveTestResult was called with the updated test run
            expect(redisService.saveTestResult).toHaveBeenCalledWith(testRun);

            // getTestResult is not called in the implementation
            // expect(redisService.getTestResult).toHaveBeenCalledWith(testRun.id);
        });

        it('should finalize a run as FAILED when any step failed', async () => {
            // Set one step to failed
            testRun.stepResults[0].status = StepStatus.PASSED;
            testRun.stepResults[1].status = StepStatus.FAILED;

            // Update summary (using non-null assertion)
            testRun.summary!.passedSteps = 1;
            testRun.summary!.failedSteps = 1;

            // Setup mocks
            redisService.saveTestResult.mockResolvedValue(undefined);
            redisService.getTestResult.mockImplementation(async (id) => {
                // Return a copy of testRun with updated status
                return {...testRun, status: TestStatus.FAILED};
            });

            // Finalize the run
            const result = await streamManager.finalizeRunIfNeeded(testRun, redisService);

            // Verify the run was finalized as FAILED
            expect(result).toBe(true);
            expect(testRun.status).toBe(TestStatus.FAILED);

            // Verify saveTestResult was called with the updated test run
            expect(redisService.saveTestResult).toHaveBeenCalledWith(testRun);

            // getTestResult is not called in the implementation
            // expect(redisService.getTestResult).toHaveBeenCalledWith(testRun.id);
        });

        it('should finalize a run as ERROR when any step had an error', async () => {
            // Set one step to error
            testRun.stepResults[0].status = StepStatus.PASSED;
            testRun.stepResults[1].status = StepStatus.ERROR;

            // Update summary (using non-null assertion)
            testRun.summary!.passedSteps = 1;
            testRun.summary!.errorSteps = 1;

            // Setup mocks
            redisService.saveTestResult.mockResolvedValue(undefined);
            redisService.getTestResult.mockImplementation(async (id) => {
                // Return a copy of testRun with updated status
                return {...testRun, status: TestStatus.ERROR};
            });

            // Finalize the run
            const result = await streamManager.finalizeRunIfNeeded(testRun, redisService);

            // Verify the run was finalized as ERROR
            expect(result).toBe(true);
            expect(testRun.status).toBe(TestStatus.ERROR);

            // Verify saveTestResult was called with the updated test run
            expect(redisService.saveTestResult).toHaveBeenCalledWith(testRun);

            // getTestResult is not called in the implementation
            // expect(redisService.getTestResult).toHaveBeenCalledWith(testRun.id);
        });
    });
});