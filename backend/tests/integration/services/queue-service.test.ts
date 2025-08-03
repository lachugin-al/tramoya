import {QueueService, QUEUE_NAMES, JobType} from '../../../src/services/queue-service';
import {RedisService} from '../../../src/services/redis-service';
import {Queue, Worker, QueueEvents, Job} from 'bullmq';

// Mock dependencies
jest.mock('bullmq');
jest.mock('../../../src/services/redis-service');

describe('QueueService Integration', () => {
    let queueService: QueueService;
    let mockRedisService: jest.Mocked<RedisService>;
    let mockQueue: jest.Mocked<Queue>;
    let mockWorker: jest.Mocked<Worker>;
    let mockQueueEvents: jest.Mocked<QueueEvents>;
    let mockJob: jest.Mocked<Job>;
    let mockRedisClient: any;

    beforeEach(async () => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Create mock Redis client
        mockRedisClient = {
            // Add any methods needed for tests
        };

        // Create mock Redis service
        mockRedisService = {
            getClient: jest.fn().mockReturnValue(mockRedisClient),
            getPublisher: jest.fn(),
            getSubscriber: jest.fn(),
            publish: jest.fn(),
            subscribe: jest.fn(),
            unsubscribe: jest.fn(),
            getTestResult: jest.fn(),
            saveTestResult: jest.fn(),
            close: jest.fn().mockResolvedValue(undefined)
        } as unknown as jest.Mocked<RedisService>;

        // Create mock Queue
        mockQueue = {
            add: jest.fn().mockImplementation(async () => ({id: 'mock-job-id'})),
            close: jest.fn().mockResolvedValue(undefined),
            on: jest.fn()
        } as unknown as jest.Mocked<Queue>;

        // Create mock Worker
        mockWorker = {
            on: jest.fn(),
            close: jest.fn().mockResolvedValue(undefined)
        } as unknown as jest.Mocked<Worker>;

        // Create mock QueueEvents
        mockQueueEvents = {
            on: jest.fn(),
            close: jest.fn().mockResolvedValue(undefined)
        } as unknown as jest.Mocked<QueueEvents>;

        // Create mock Job
        mockJob = {
            id: 'mock-job-id'
        } as unknown as jest.Mocked<Job>;

        // Setup mock implementations
        (Queue as jest.MockedClass<typeof Queue>).mockImplementation(() => mockQueue);
        (Worker as jest.MockedClass<typeof Worker>).mockImplementation(() => mockWorker);
        (QueueEvents as jest.MockedClass<typeof QueueEvents>).mockImplementation(() => mockQueueEvents);

        // Create the queue service with the mock Redis service
        queueService = new QueueService(mockRedisService);
    });

    afterEach(async () => {
        // Reset all mocks
        jest.resetAllMocks();
    });

    describe('Queue and Job Management', () => {
        it('should create a queue and add a job', async () => {
            // Create a test queue
            const queueName = 'test-queue';
            const queue = queueService.createQueue(queueName);

            // Verify Queue constructor was called with the correct parameters
            expect(Queue).toHaveBeenCalledWith(queueName, {
                connection: mockRedisClient
            });

            // Verify QueueEvents constructor was called with the correct parameters
            expect(QueueEvents).toHaveBeenCalledWith(queueName, {
                connection: mockRedisClient
            });

            // Verify the queue was returned
            expect(queue).toBe(mockQueue);

            // Add a job to the queue
            const jobData = {testId: 'integration-test-123'};
            const jobId = await queueService.addJob(queueName, JobType.EXECUTE_TEST, jobData);

            // Verify queue.add was called with the correct parameters
            expect(mockQueue.add).toHaveBeenCalledWith(JobType.EXECUTE_TEST, jobData, expect.any(Object));

            // Verify the job ID was returned
            expect(jobId).toBe('mock-job-id');
        });

        it('should retrieve an existing queue', async () => {
            // Create a test queue
            const queueName = 'test-queue';
            const queue1 = queueService.createQueue(queueName);

            // Reset mocks to verify they aren't called again
            jest.clearAllMocks();

            // Retrieve the same queue
            const queue2 = queueService.getQueue(queueName);

            // Verify Queue constructor wasn't called again
            expect(Queue).not.toHaveBeenCalled();

            // Verify the same queue was returned
            expect(queue2).toBe(queue1);
        });

        it('should return undefined for a non-existent queue', async () => {
            const nonExistentQueue = queueService.getQueue('non-existent-queue');

            expect(nonExistentQueue).toBeUndefined();
        });
    });

    describe('Worker Processing', () => {
        it('should create a worker for a queue', async () => {
            // Create a test queue
            const queueName = 'test-worker-queue';
            const queue = queueService.createQueue(queueName);

            // Create a processor function
            const processor = jest.fn();

            // Create a worker for the queue
            const worker = queueService.createWorker(queueName, processor);

            // Verify Worker constructor was called with the correct parameters
            expect(Worker).toHaveBeenCalledWith(queueName, processor, {
                connection: mockRedisClient,
                autorun: true
            });

            // Verify event handlers were set up
            expect(mockWorker.on).toHaveBeenCalledWith('completed', expect.any(Function));
            expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
            expect(mockWorker.on).toHaveBeenCalledWith('error', expect.any(Function));

            // Verify the worker was returned
            expect(worker).toBe(mockWorker);
        });

        it('should return existing worker for the same queue', async () => {
            // Create a test queue
            const queueName = 'test-worker-queue';
            const queue = queueService.createQueue(queueName);

            // Create a processor function
            const processor = jest.fn();

            // Create a worker first time
            const worker1 = queueService.createWorker(queueName, processor);

            // Reset mocks to verify they aren't called again
            jest.clearAllMocks();

            // Create worker second time
            const worker2 = queueService.createWorker(queueName, processor);

            // Verify Worker constructor wasn't called again
            expect(Worker).not.toHaveBeenCalled();

            // Verify the same worker was returned
            expect(worker2).toBe(worker1);
        });
    });

    describe('Service Shutdown', () => {
        it('should close all queues and workers gracefully', async () => {
            // Create multiple queues and workers
            const queueNames = [
                'test-close-queue-1',
                'test-close-queue-2'
            ];

            const workers = [];

            for (const queueName of queueNames) {
                // Create queue
                queueService.createQueue(queueName);

                // Create worker
                const processor = jest.fn();
                const worker = queueService.createWorker(queueName, processor);
                workers.push(worker);
            }

            // Close the queue service
            await queueService.close();

            // Verify all workers were closed
            expect(mockWorker.close).toHaveBeenCalledTimes(2);

            // Verify all queue events were closed
            expect(mockQueueEvents.close).toHaveBeenCalledTimes(2);

            // Verify all queues were closed
            expect(mockQueue.close).toHaveBeenCalledTimes(2);
        });
    });
});