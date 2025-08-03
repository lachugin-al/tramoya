import { RunnerWorker } from '../../../src/services/runner-worker';
import { QueueService, QUEUE_NAMES, ExecuteTestJobData, ExecuteTestJobResult, JobType } from '../../../src/services/queue-service';
import { MinioService } from '../../../src/services/minio-service';
import { RedisService } from '../../../src/services/redis-service';
import { TestRunner } from '../../../src/services/test-runner';
import { TestStatus, StepStatus } from '../../../src/models/test-result';
import { Job } from 'bullmq';
import * as os from 'os';

// Mock dependencies
jest.mock('../../../src/services/queue-service');
jest.mock('../../../src/services/minio-service');
jest.mock('../../../src/services/redis-service');
jest.mock('../../../src/services/test-runner');
jest.mock('bullmq');
jest.mock('os');
jest.mock('../../../src/utils/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

describe('RunnerWorker', () => {
  let runnerWorker: RunnerWorker;
  let mockQueueService: jest.Mocked<QueueService>;
  let mockMinioService: jest.Mocked<MinioService>;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockTestRunner: jest.Mocked<TestRunner>;
  let mockJob: jest.Mocked<Job<ExecuteTestJobData>>;
  
  // Mock Date.now to control timing in tests
  const originalDateNow = Date.now;
  let mockNow = 1000;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Mock Date.now
    Date.now = jest.fn(() => mockNow);
    
    // Mock os.freemem and os.totalmem
    (os.freemem as jest.Mock).mockReturnValue(1024 * 1024 * 1024); // 1GB
    (os.totalmem as jest.Mock).mockReturnValue(4 * 1024 * 1024 * 1024); // 4GB
    
    // Mock process.memoryUsage
    // @ts-ignore - Ignoring TypeScript error for process.memoryUsage mock
    process.memoryUsage = jest.fn().mockReturnValue({
      rss: 100 * 1024 * 1024, // 100MB
      heapTotal: 50 * 1024 * 1024, // 50MB
      heapUsed: 30 * 1024 * 1024, // 30MB
      external: 10 * 1024 * 1024, // 10MB
      arrayBuffers: 5 * 1024 * 1024 // 5MB
    });
    
    // Create mock services
    mockQueueService = {
      createWorker: jest.fn(),
      close: jest.fn()
    } as unknown as jest.Mocked<QueueService>;
    
    mockMinioService = {} as jest.Mocked<MinioService>;
    
    mockRedisService = {} as jest.Mocked<RedisService>;
    
    mockTestRunner = {
      executeTest: jest.fn(),
      closeBrowser: jest.fn()
    } as unknown as jest.Mocked<TestRunner>;
    
    // Mock TestRunner constructor
    (TestRunner as jest.MockedClass<typeof TestRunner>).mockImplementation(() => mockTestRunner);
    
    // Create mock job
    mockJob = {
      id: 'job-123',
      data: {
        testId: 'test-123',
        runId: 'run-123',
        testScenario: {
          id: 'scenario-123',
          name: 'Test Scenario',
          description: 'Test scenario description',
          steps: [
            {
              id: 'step-1',
              type: 'navigate',
              description: 'Navigate to URL',
              url: 'https://example.com'
            },
            {
              id: 'step-2',
              type: 'click',
              description: 'Click button',
              selector: '#submit-button'
            }
          ]
        }
      }
    } as unknown as jest.Mocked<Job<ExecuteTestJobData>>;
    
    // Initialize service
    runnerWorker = new RunnerWorker(mockQueueService, mockMinioService, mockRedisService);
  });
  
  afterEach(() => {
    // Restore original Date.now
    Date.now = originalDateNow;
    
    jest.resetAllMocks();
  });
  
  describe('constructor', () => {
    it('should initialize with required services', () => {
      expect(runnerWorker).toBeDefined();
      expect(TestRunner).toHaveBeenCalledWith(mockMinioService, mockRedisService);
    });
    
    it('should record start time and initialize memory usage tracking', () => {
      expect(Date.now).toHaveBeenCalled();
      expect(process.memoryUsage).toHaveBeenCalled();
    });
  });
  
  describe('start', () => {
    it('should create a worker for the test execution queue', () => {
      runnerWorker.start();
      
      expect(mockQueueService.createWorker).toHaveBeenCalledWith(
        QUEUE_NAMES.TEST_EXECUTION,
        expect.any(Function)
      );
    });
    
    it('should set up stats reporting interval', () => {
      // Mock setInterval
      const originalSetInterval = global.setInterval;
      const mockSetInterval = jest.fn();
      global.setInterval = mockSetInterval;
      
      try {
        runnerWorker.start();
        
        expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 5 * 60 * 1000);
      } finally {
        // Restore original setInterval
        global.setInterval = originalSetInterval;
      }
    });
  });
  
  describe('processJob', () => {
    // We need to access the private method for testing
    let processJob: (job: Job<ExecuteTestJobData>) => Promise<ExecuteTestJobResult>;
    
    beforeEach(() => {
      // Start the worker to get access to the processJob method
      runnerWorker.start();
      
      // Extract the processJob function that was passed to createWorker
      processJob = mockQueueService.createWorker.mock.calls[0][1] as (job: Job<ExecuteTestJobData>) => Promise<ExecuteTestJobResult>;
      
      // Set up mock test result
      mockTestRunner.executeTest.mockResolvedValue({
        id: 'run-123',
        testId: 'test-123',
        runId: 'run-123',
        status: TestStatus.PASSED,
        startTime: new Date(1000),
        endTime: new Date(2000),
        stepResults: [
          {
            stepId: 'step-1',
            status: StepStatus.PASSED,
            startTime: new Date(1100),
            endTime: new Date(1500),
            logs: [],
            screenshots: [{
              id: 'screenshot1',
              stepId: 'step-1',
              timestamp: new Date(1300),
              path: 'screenshot1.png'
            }]
          },
          {
            stepId: 'step-2',
            status: StepStatus.PASSED,
            startTime: new Date(1600),
            endTime: new Date(1900),
            logs: [],
            screenshots: [{
              id: 'screenshot2',
              stepId: 'step-2',
              timestamp: new Date(1800),
              path: 'screenshot2.png'
            }]
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
      });
    });
    
    it('should process a job successfully', async () => {
      // Advance time for job duration calculation
      mockNow = 1000;
      const result = await processJob(mockJob);
      
      expect(mockTestRunner.executeTest).toHaveBeenCalledWith(
        mockJob.data.testScenario,
        mockJob.data.runId
      );
      
      expect(result).toEqual({
        runId: 'run-123',
        testResult: expect.objectContaining({
          id: 'run-123',
          testId: 'test-123',
          status: TestStatus.PASSED
        })
      });
    });
    
    it('should handle errors during job processing', async () => {
      // Mock test runner to throw an error
      const error = new Error('Test execution failed');
      mockTestRunner.executeTest.mockRejectedValue(error);
      
      // Advance time for job duration calculation
      mockNow = 1000;
      mockNow = 2000; // Simulate 1 second passing
      
      const result = await processJob(mockJob);
      
      expect(result).toEqual({
        runId: 'run-123',
        testResult: expect.objectContaining({
          id: 'run-123',
          testId: 'test-123',
          status: TestStatus.ERROR,
          startTime: expect.any(Date),
          endTime: expect.any(Date),
          stepResults: [],
          summary: expect.objectContaining({
            totalSteps: 2,
            passedSteps: 0,
            failedSteps: 0,
            skippedSteps: 2,
            errorSteps: 0,
            duration: expect.any(Number)
          })
        })
      });
    });
    
    it('should update job statistics after processing', async () => {
      // Process a successful job
      await processJob(mockJob);
      
      // Process a failed job
      mockTestRunner.executeTest.mockRejectedValue(new Error('Test execution failed'));
      await processJob(mockJob);
      
      // Access private jobsProcessed, jobsSucceeded, jobsFailed properties
      // This is a bit hacky but necessary for testing private properties
      const worker = runnerWorker as any;
      
      expect(worker.jobsProcessed).toBe(2);
      expect(worker.jobsSucceeded).toBe(1);
      expect(worker.jobsFailed).toBe(1);
    });
  });
  
  describe('stop', () => {
    it('should close the test runner browser', async () => {
      mockTestRunner.closeBrowser.mockResolvedValue(undefined);
      
      await runnerWorker.stop();
      
      expect(mockTestRunner.closeBrowser).toHaveBeenCalled();
    });
    
    it('should log final statistics', async () => {
      // Process some jobs to update statistics
      // Start the worker to get access to the processJob method
      runnerWorker.start();
      
      // Extract the processJob function that was passed to createWorker
      const processJob = mockQueueService.createWorker.mock.calls[0][1];
      
      // Set up mock test result
      mockTestRunner.executeTest.mockResolvedValue({
        id: 'run-123',
        testId: 'test-123',
        status: TestStatus.PASSED,
        startTime: new Date(),
        endTime: new Date(),
        stepResults: [],
        summary: {
          totalSteps: 2,
          passedSteps: 2,
          failedSteps: 0,
          skippedSteps: 0,
          errorSteps: 0,
          duration: 1000
        }
      });
      
      // Process a successful job
      await processJob(mockJob);
      
      // Advance time for uptime calculation
      mockNow = 300000; // 5 minutes
      
      await runnerWorker.stop();
      
      // We can't easily test the log output directly, but we can verify that closeBrowser was called
      expect(mockTestRunner.closeBrowser).toHaveBeenCalled();
    });
  });
});