import { Job } from 'bullmq';
import { createLogger } from '../utils/logger';
import { QueueService, QUEUE_NAMES, ExecuteTestJobData, ExecuteTestJobResult, JobType } from './queue-service';
import { TestRunner } from './test-runner';
import { MinioService } from './minio-service';
import { RedisService } from './redis-service';
import { TestStatus } from '../models/test-result';

const logger = createLogger('runner-worker');

/**
 * Runner worker service that processes test execution jobs
 */
export class RunnerWorker {
  private queueService: QueueService;
  private testRunner: TestRunner;
  
  constructor(queueService: QueueService, minioService: MinioService, redisService: RedisService) {
    this.queueService = queueService;
    this.testRunner = new TestRunner(minioService, redisService);
    
    logger.info('RunnerWorker initialized');
  }
  
  /**
   * Start the worker
   */
  public start(): void {
    logger.info('Starting runner worker');
    
    // Create worker for test execution queue
    this.queueService.createWorker<ExecuteTestJobData, ExecuteTestJobResult>(
      QUEUE_NAMES.TEST_EXECUTION,
      this.processJob.bind(this)
    );
    
    logger.info('Runner worker started');
  }
  
  /**
   * Process a test execution job
   * @param job The job to process
   * @returns The job result
   */
  private async processJob(job: Job<ExecuteTestJobData>): Promise<ExecuteTestJobResult> {
    const { testId, runId, testScenario } = job.data;
    
    logger.info(`Processing test execution job: ${job.id}, test: ${testId}, run: ${runId}`);
    
    try {
      // Execute the test
      const testResult = await this.testRunner.executeTest(testScenario, runId);
      
      logger.info(`Test execution completed: ${testId}, status: ${testResult.status}`);
      
      return {
        runId,
        testResult
      };
    } catch (error) {
      logger.error(`Error executing test: ${error instanceof Error ? error.message : String(error)}`);
      
      // Return a failed result
      return {
        runId,
        testResult: {
          id: runId,
          testId,
          status: TestStatus.ERROR,
          startTime: new Date(),
          endTime: new Date(),
          stepResults: [],
          summary: {
            totalSteps: 0,
            passedSteps: 0,
            failedSteps: 0,
            skippedSteps: 0,
            errorSteps: 0,
            duration: 0
          }
        }
      };
    }
  }
  
  /**
   * Stop the worker
   */
  public async stop(): Promise<void> {
    logger.info('Stopping runner worker');
    
    // Close the test runner
    await this.testRunner.closeBrowser();
    
    logger.info('Runner worker stopped');
  }
}