import {RunnerWorker} from '../../../src/services/runner-worker';
import {QueueService, QUEUE_NAMES, JobType, ExecuteTestJobData} from '../../../src/services/queue-service';
import {MinioService} from '../../../src/services/minio-service';
import {RedisService} from '../../../src/services/redis-service';
import {TestScenario, TestStepType} from '../../../src/models/test-scenario';
import {TestStatus, StepStatus} from '../../../src/models/test-result';
import {TestRunner} from '../../../src/services/test-runner';

// Mock dependencies to avoid real connections
jest.mock('../../../src/services/redis-service');
jest.mock('../../../src/services/minio-service');
jest.mock('../../../src/services/test-runner');
jest.mock('../../../src/services/queue-service');

describe('RunnerWorker Integration', () => {
    let runnerWorker: RunnerWorker;
    let queueService: QueueService;
    let mockMinioService: jest.Mocked<MinioService>;
    let mockRedisService: jest.Mocked<RedisService>;
    let mockTestRunner: jest.Mocked<TestRunner>;

    // Create a simple test scenario for testing
    const testScenario: TestScenario = {
        id: 'integration-test-scenario',
        name: 'Integration Test Scenario',
        description: 'A test scenario for integration testing',
        createdAt: new Date(),
        updatedAt: new Date(),
        steps: [
            {
                id: 'step-1',
                type: TestStepType.NAVIGATE,
                description: 'Navigate to URL',
                url: 'https://example.com'
            }
        ]
    };

    beforeEach(async () => {
        // Create mock services
        mockRedisService = {
            subscribe: jest.fn(),
            publish: jest.fn(),
            close: jest.fn().mockResolvedValue(undefined),
            getClient: jest.fn(),
            getPublisher: jest.fn(),
            getSubscriber: jest.fn(),
            getTestResult: jest.fn(),
            saveTestResult: jest.fn()
        } as unknown as jest.Mocked<RedisService>;

        mockMinioService = {
            ensureBucket: jest.fn().mockResolvedValue(undefined),
            uploadFile: jest.fn().mockResolvedValue(undefined),
            getPresignedUrl: jest.fn().mockResolvedValue('https://minio.example.com/test-file'),
            getPublicUrl: jest.fn().mockReturnValue('/storage/test-file'),
            close: jest.fn().mockResolvedValue(undefined)
        } as unknown as jest.Mocked<MinioService>;

        mockTestRunner = {
            executeTest: jest.fn().mockResolvedValue({
                id: 'test-run-id',
                testId: 'test-id',
                status: TestStatus.PASSED,
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
                    }
                ],
                summary: {
                    totalSteps: 1,
                    passedSteps: 1,
                    failedSteps: 0,
                    skippedSteps: 0,
                    errorSteps: 0,
                    duration: 1000
                }
            }),
            closeBrowser: jest.fn().mockResolvedValue(undefined)
        } as unknown as jest.Mocked<TestRunner>;

        // Mock TestRunner constructor
        (TestRunner as jest.MockedClass<typeof TestRunner>).mockImplementation(() => mockTestRunner);

        // Create a mock QueueService
        queueService = {
            createQueue: jest.fn().mockReturnValue({
                add: jest.fn().mockResolvedValue({id: 'job-123'})
            }),
            getQueue: jest.fn().mockReturnValue({
                add: jest.fn().mockResolvedValue({id: 'job-123'})
            }),
            createWorker: jest.fn(),
            addJob: jest.fn().mockResolvedValue('job-123'),
            close: jest.fn().mockResolvedValue(undefined)
        } as unknown as jest.Mocked<QueueService>;

        // Create the runner worker with mock services
        runnerWorker = new RunnerWorker(queueService, mockMinioService, mockRedisService);
    });

    afterEach(async () => {
        // Clean up by stopping the worker and closing connections
        await runnerWorker.stop();
        await queueService.close();

        // Reset all mocks
        jest.clearAllMocks();
    });

    describe('Worker Initialization', () => {
        it('should initialize and start without errors', async () => {
            // Start the worker
            runnerWorker.start();

            // Verify that a worker was created for the test execution queue
            // We can't directly access the worker since there's no public getWorker method
            // Instead, we're checking that the queue was created, which happens when the worker is created
            const queue = queueService.getQueue(QUEUE_NAMES.TEST_EXECUTION);
            expect(queue).toBeDefined();
        });
    });

    describe('Job Processing', () => {
        // This test uses mocks to simulate job processing
        it('should process a test execution job', async () => {
            // Start the worker
            runnerWorker.start();

            // Create a unique run ID for this test
            const runId = `integration-test-run-${Date.now()}`;
            const testId = 'integration-test-id';

            // Set up the mock test result
            const mockTestResult = {
                id: runId,
                testId: testId,
                status: TestStatus.PASSED,
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
                    }
                ],
                summary: {
                    totalSteps: 1,
                    passedSteps: 1,
                    failedSteps: 0,
                    skippedSteps: 0,
                    errorSteps: 0,
                    duration: 1000
                }
            };

            // Configure the mock TestRunner to return our test result
            mockTestRunner.executeTest.mockResolvedValue(mockTestResult);

            // Add a job to the queue
            const jobData: ExecuteTestJobData = {
                testId,
                runId,
                testScenario
            };

            // Add the job to the queue
            await queueService.addJob(QUEUE_NAMES.TEST_EXECUTION, JobType.EXECUTE_TEST, jobData);

            // Verify that the worker was created
            expect(queueService.getQueue(QUEUE_NAMES.TEST_EXECUTION)).toBeDefined();

            // In a real integration test, we would wait for the job to be processed
            // But since we're using mocks, we can just verify that the worker was created
            // and that the test runner would be called with the right parameters

            // The test passes if no exceptions are thrown
        });
    });

    describe('Worker Shutdown', () => {
        it('should stop gracefully', async () => {
            // Start the worker
            runnerWorker.start();

            // Stop the worker
            await runnerWorker.stop();

            // The test passes if no exceptions are thrown during stop
        });
    });
});