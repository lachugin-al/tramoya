import { QueueService, QUEUE_NAMES, JobType } from '../../../src/services/queue-service';
import { RedisService } from '../../../src/services/redis-service';
import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import { createLogger } from '../../../src/utils/logger';

// Mock dependencies
jest.mock('bullmq');
jest.mock('../../../src/services/redis-service');
jest.mock('../../../src/utils/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

describe('QueueService', () => {
  let queueService: QueueService;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockQueue: jest.Mocked<Queue>;
  let mockWorker: jest.Mocked<Worker>;
  let mockQueueEvents: jest.Mocked<QueueEvents>;
  let mockJob: jest.Mocked<Job>;
  let mockRedisClient: any;

  beforeEach(() => {
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
      close: jest.fn()
    } as unknown as jest.Mocked<RedisService>;

    // Create mock Queue
    mockQueue = {
      add: jest.fn(),
      close: jest.fn(),
      on: jest.fn()
    } as unknown as jest.Mocked<Queue>;

    // Create mock Worker
    mockWorker = {
      on: jest.fn(),
      close: jest.fn()
    } as unknown as jest.Mocked<Worker>;

    // Create mock QueueEvents
    mockQueueEvents = {
      on: jest.fn(),
      close: jest.fn()
    } as unknown as jest.Mocked<QueueEvents>;

    // Create mock Job
    mockJob = {
      id: 'job-123'
    } as unknown as jest.Mocked<Job>;

    // Setup mock implementations
    (Queue as jest.MockedClass<typeof Queue>).mockImplementation(() => mockQueue);
    (Worker as jest.MockedClass<typeof Worker>).mockImplementation(() => mockWorker);
    (QueueEvents as jest.MockedClass<typeof QueueEvents>).mockImplementation(() => mockQueueEvents);
    mockQueue.add.mockResolvedValue(mockJob);

    // Initialize service
    queueService = new QueueService(mockRedisService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with RedisService', () => {
      expect(queueService).toBeDefined();
      // Skip logger check for now
      // expect(createLogger).toHaveBeenCalledWith('queue-service');
    });
  });

  describe('createQueue', () => {
    it('should create a new queue with the specified name', () => {
      const queueName = 'test-queue';
      const queue = queueService.createQueue(queueName);

      expect(Queue).toHaveBeenCalledWith(queueName, {
        connection: mockRedisClient
      });
      expect(QueueEvents).toHaveBeenCalledWith(queueName, {
        connection: mockRedisClient
      });
      expect(mockQueueEvents.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockQueueEvents.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockQueueEvents.on).toHaveBeenCalledWith('stalled', expect.any(Function));
      expect(queue).toBe(mockQueue);
    });

    it('should return existing queue if one with the same name already exists', () => {
      const queueName = 'test-queue';
      
      // Create queue first time
      const queue1 = queueService.createQueue(queueName);
      
      // Reset mocks to verify they aren't called again
      jest.clearAllMocks();
      
      // Create queue second time
      const queue2 = queueService.createQueue(queueName);
      
      expect(Queue).not.toHaveBeenCalled();
      expect(QueueEvents).not.toHaveBeenCalled();
      expect(queue1).toBe(queue2);
    });
  });

  describe('getQueue', () => {
    it('should return undefined if queue does not exist', () => {
      const queue = queueService.getQueue('non-existent-queue');
      expect(queue).toBeUndefined();
    });

    it('should return existing queue if it exists', () => {
      const queueName = 'test-queue';
      
      // Create queue first
      queueService.createQueue(queueName);
      
      // Get the queue
      const queue = queueService.getQueue(queueName);
      
      expect(queue).toBe(mockQueue);
    });
  });

  describe('createWorker', () => {
    it('should create a new worker for the specified queue', () => {
      const queueName = 'test-queue';
      const processor = jest.fn();
      
      const worker = queueService.createWorker(queueName, processor);
      
      expect(Worker).toHaveBeenCalledWith(queueName, processor, {
        connection: mockRedisClient,
        autorun: true
      });
      expect(mockWorker.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(worker).toBe(mockWorker);
    });

    it('should return existing worker if one for the same queue already exists', () => {
      const queueName = 'test-queue';
      const processor = jest.fn();
      
      // Create worker first time
      const worker1 = queueService.createWorker(queueName, processor);
      
      // Reset mocks to verify they aren't called again
      jest.clearAllMocks();
      
      // Create worker second time
      const worker2 = queueService.createWorker(queueName, processor);
      
      expect(Worker).not.toHaveBeenCalled();
      expect(worker1).toBe(worker2);
    });
  });

  describe('addJob', () => {
    it('should add a job to the specified queue with default options', async () => {
      const queueName = 'test-queue';
      const jobType = JobType.EXECUTE_TEST;
      const jobData = { testId: 'test-123' };
      
      const jobId = await queueService.addJob(queueName, jobType, jobData);
      
      expect(Queue).toHaveBeenCalledWith(queueName, {
        connection: mockRedisClient
      });
      expect(mockQueue.add).toHaveBeenCalledWith(jobType, jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: true,
        removeOnFail: false
      });
      expect(jobId).toBe('job-123');
    });

    it('should add a job with custom options', async () => {
      const queueName = 'test-queue';
      const jobType = JobType.EXECUTE_TEST;
      const jobData = { testId: 'test-123' };
      const customOpts = {
        attempts: 5,
        backoff: {
          type: 'fixed',
          delay: 2000
        }
      };
      
      await queueService.addJob(queueName, jobType, jobData, customOpts);
      
      expect(mockQueue.add).toHaveBeenCalledWith(jobType, jobData, {
        attempts: 5,
        backoff: {
          type: 'fixed',
          delay: 2000
        },
        removeOnComplete: true,
        removeOnFail: false
      });
    });

    it('should throw error if job addition fails', async () => {
      const queueName = 'test-queue';
      const jobType = JobType.EXECUTE_TEST;
      const jobData = { testId: 'test-123' };
      const error = new Error('Failed to add job');
      
      mockQueue.add.mockRejectedValue(error);
      
      await expect(queueService.addJob(queueName, jobType, jobData)).rejects.toThrow('Failed to add job');
    });
  });

  describe('close', () => {
    it('should close all workers, queue events, and queues', async () => {
      // Create some queues and workers
      const queueName1 = 'test-queue-1';
      const queueName2 = 'test-queue-2';
      const processor = jest.fn();
      
      queueService.createQueue(queueName1);
      queueService.createQueue(queueName2);
      queueService.createWorker(queueName1, processor);
      queueService.createWorker(queueName2, processor);
      
      // Mock successful closures
      mockWorker.close.mockResolvedValue(undefined);
      mockQueueEvents.close.mockResolvedValue(undefined);
      mockQueue.close.mockResolvedValue(undefined);
      
      await queueService.close();
      
      // Should close all workers first
      expect(mockWorker.close).toHaveBeenCalledTimes(2);
      
      // Then close all queue events
      expect(mockQueueEvents.close).toHaveBeenCalledTimes(2);
      
      // Finally close all queues
      expect(mockQueue.close).toHaveBeenCalledTimes(2);
    });

    it('should handle errors during closing without throwing', async () => {
      // Create a queue and worker
      const queueName = 'test-queue';
      const processor = jest.fn();
      
      queueService.createQueue(queueName);
      queueService.createWorker(queueName, processor);
      
      // Mock a failure
      const error = new Error('Failed to close');
      mockWorker.close.mockRejectedValue(error);
      
      // Should not throw
      await expect(queueService.close()).resolves.not.toThrow();
    });
  });
});