import { Job } from 'bullmq';
import { createLogger } from '../utils/logger';
import { QueueService, QUEUE_NAMES, ExecuteTestJobData, ExecuteTestJobResult, JobType } from './queue-service';
import { TestRunner } from './test-runner';
import { MinioService } from './minio-service';
import { RedisService } from './redis-service';
import { TestStatus } from '../models/test-result';
import os from 'os';

const logger = createLogger('runner-worker');

/**
 * Runner worker service that processes test execution jobs
 */
export class RunnerWorker {
  private queueService: QueueService;
  private testRunner: TestRunner;
  private jobsProcessed: number = 0;
  private jobsSucceeded: number = 0;
  private jobsFailed: number = 0;
  private startTime: number;
  
  constructor(queueService: QueueService, minioService: MinioService, redisService: RedisService) {
    this.startTime = Date.now();
    
    logger.debug('Initializing RunnerWorker');
    this.queueService = queueService;
    
    logger.debug('Creating TestRunner instance');
    const testRunnerStartTime = Date.now();
    this.testRunner = new TestRunner(minioService, redisService);
    logger.debug('TestRunner instance created', {
      initTime: `${Date.now() - testRunnerStartTime}ms`
    });
    
    logger.info('RunnerWorker initialized', {
      initTime: `${Date.now() - this.startTime}ms`,
      memory: this.getMemoryUsage()
    });
  }
  
  /**
   * Get current memory usage
   */
  private getMemoryUsage(): any {
    const memoryUsage = process.memoryUsage();
    return {
      rss: `${Math.round(memoryUsage.rss / (1024 * 1024))}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / (1024 * 1024))}MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / (1024 * 1024))}MB`,
      external: `${Math.round(memoryUsage.external / (1024 * 1024))}MB`,
      systemFree: `${Math.round(os.freemem() / (1024 * 1024))}MB`,
      systemTotal: `${Math.round(os.totalmem() / (1024 * 1024))}MB`
    };
  }
  
  /**
   * Start the worker
   */
  public start(): void {
    const startTime = Date.now();
    logger.info('Starting runner worker');
    
    // Create worker for test execution queue
    logger.debug('Creating worker for test execution queue');
    this.queueService.createWorker<ExecuteTestJobData, ExecuteTestJobResult>(
      QUEUE_NAMES.TEST_EXECUTION,
      this.processJob.bind(this)
    );
    
    // Start stats reporting
    this.startStatsReporting();
    
    logger.info('Runner worker started', {
      startTime: `${Date.now() - startTime}ms`,
      queue: QUEUE_NAMES.TEST_EXECUTION
    });
  }
  
  /**
   * Start periodic stats reporting
   */
  private startStatsReporting(): void {
    // Report stats every 5 minutes
    const interval = setInterval(() => {
      const uptime = Date.now() - this.startTime;
      logger.info('Worker stats', {
        uptime: `${Math.round(uptime / 1000 / 60)}m`,
        jobsProcessed: this.jobsProcessed,
        jobsSucceeded: this.jobsSucceeded,
        jobsFailed: this.jobsFailed,
        successRate: this.jobsProcessed > 0 ? 
          `${Math.round((this.jobsSucceeded / this.jobsProcessed) * 100)}%` : 'N/A',
        memory: this.getMemoryUsage()
      });
    }, 5 * 60 * 1000); // Every 5 minutes
    
    // Clear interval on process exit
    process.on('exit', () => {
      clearInterval(interval);
    });
  }
  
  /**
   * Process a test execution job
   * @param job The job to process
   * @returns The job result
   */
  private async processJob(job: Job<ExecuteTestJobData>): Promise<ExecuteTestJobResult> {
    const { testId, runId, testScenario } = job.data;
    const jobStartTime = Date.now();
    
    logger.info('Processing test execution job', {
      jobId: job.id,
      testId,
      runId,
      testName: testScenario.name,
      stepsCount: testScenario.steps.length
    });
    
    try {
      // Execute the test
      logger.debug('Executing test', {
        testId,
        runId,
        steps: testScenario.steps.map(step => ({
          id: step.id,
          type: step.type,
          description: step.description
        }))
      });
      
      const testStartTime = Date.now();
      const testResult = await this.testRunner.executeTest(testScenario, runId);
      const testDuration = Date.now() - testStartTime;
      
      // Update stats
      this.jobsProcessed++;
      this.jobsSucceeded++;
      
      logger.info('Test execution completed', {
        testId,
        runId,
        status: testResult.status,
        duration: `${testDuration}ms`,
        summary: testResult.summary,
        jobDuration: `${Date.now() - jobStartTime}ms`
      });
      
      return {
        runId,
        testResult
      };
    } catch (error) {
      // Update stats
      this.jobsProcessed++;
      this.jobsFailed++;
      
      logger.error('Error executing test', {
        jobId: job.id,
        testId,
        runId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        jobDuration: `${Date.now() - jobStartTime}ms`
      });
      
      // Return a failed result
      return {
        runId,
        testResult: {
          id: runId,
          testId,
          status: TestStatus.ERROR,
          startTime: new Date(jobStartTime),
          endTime: new Date(),
          stepResults: [],
          summary: {
            totalSteps: testScenario.steps.length,
            passedSteps: 0,
            failedSteps: 0,
            skippedSteps: testScenario.steps.length,
            errorSteps: 0,
            duration: Date.now() - jobStartTime
          }
        }
      };
    }
  }
  
  /**
   * Stop the worker
   */
  public async stop(): Promise<void> {
    const stopTime = Date.now();
    logger.info('Stopping runner worker');
    
    // Close the test runner
    logger.debug('Closing test runner browser');
    const browserCloseTime = Date.now();
    await this.testRunner.closeBrowser();
    logger.debug('Test runner browser closed', {
      closeTime: `${Date.now() - browserCloseTime}ms`
    });
    
    // Log final stats
    const uptime = Date.now() - this.startTime;
    logger.info('Final worker stats', {
      uptime: `${Math.round(uptime / 1000 / 60)}m`,
      jobsProcessed: this.jobsProcessed,
      jobsSucceeded: this.jobsSucceeded,
      jobsFailed: this.jobsFailed,
      successRate: this.jobsProcessed > 0 ? 
        `${Math.round((this.jobsSucceeded / this.jobsProcessed) * 100)}%` : 'N/A'
    });
    
    logger.info('Runner worker stopped', {
      stopTime: `${Date.now() - stopTime}ms`,
      totalUptime: `${Math.round(uptime / 1000 / 60)}m`
    });
  }
}