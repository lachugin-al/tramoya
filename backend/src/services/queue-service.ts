import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { RedisService } from './redis-service';
import { createLogger } from '../utils/logger';
import { TestScenario } from '../models/test-scenario';
import { TestResult } from '../models/test-result';

const logger = createLogger('queue-service');

// Queue names
export const QUEUE_NAMES = {
  TEST_EXECUTION: 'test-execution'
};

// Event channel names
export const EVENT_CHANNELS = {
  TEST_EVENTS: 'test-events'
};

// Job types
export enum JobType {
  EXECUTE_TEST = 'execute-test'
}

// Job data interfaces
export interface ExecuteTestJobData {
  testId: string;
  runId: string;
  testScenario: TestScenario;
}

// Job result interfaces
export interface ExecuteTestJobResult {
  runId: string;
  testResult: TestResult;
}

/**
 * Service for managing job queues
 */
export class QueueService {
  private redisService: RedisService;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  
  constructor(redisService: RedisService) {
    this.redisService = redisService;
    logger.info('QueueService initialized');
  }
  
  /**
   * Create a queue
   * @param name Queue name
   * @returns Queue instance
   */
  public createQueue(name: string): Queue {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }
    
    const queue = new Queue(name, {
      connection: this.redisService.getClient() as any
    });
    
    this.queues.set(name, queue);
    logger.info(`Queue created: ${name}`);
    
    // Create queue events
    const queueEvents = new QueueEvents(name, {
      connection: this.redisService.getClient() as any
    });
    
    this.queueEvents.set(name, queueEvents);
    
    // Set up event listeners
    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      logger.info(`Job completed: ${jobId}`);
    });
    
    queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error(`Job failed: ${jobId}, reason: ${failedReason}`);
    });
    
    queueEvents.on('stalled', ({ jobId }) => {
      logger.warn(`Job stalled: ${jobId}`);
    });
    
    return queue;
  }
  
  /**
   * Get a queue by name
   * @param name Queue name
   * @returns Queue instance
   */
  public getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }
  
  /**
   * Create a worker for processing jobs
   * @param queueName Queue name
   * @param processor Job processor function
   * @returns Worker instance
   */
  public createWorker<T, R>(
    queueName: string,
    processor: (job: Job<T>) => Promise<R>
  ): Worker<T, R> {
    if (this.workers.has(queueName)) {
      return this.workers.get(queueName) as Worker<T, R>;
    }
    
    const worker = new Worker<T, R>(queueName, processor, {
      connection: this.redisService.getClient() as any,
      autorun: true
    });
    
    this.workers.set(queueName, worker);
    logger.info(`Worker created for queue: ${queueName}`);
    
    // Set up event listeners
    worker.on('completed', (job) => {
      logger.info(`Worker completed job: ${job.id}`);
    });
    
    worker.on('failed', (job, error) => {
      logger.error(`Worker failed job: ${job?.id}, error: ${error.message}`);
    });
    
    worker.on('error', (error) => {
      logger.error(`Worker error: ${error.message}`);
    });
    
    return worker;
  }
  
  /**
   * Add a job to a queue
   * @param queueName Queue name
   * @param jobType Job type
   * @param data Job data
   * @param opts Job options
   * @returns Job ID
   */
  public async addJob<T>(
    queueName: string,
    jobType: string,
    data: T,
    opts: any = {}
  ): Promise<string> {
    const queue = this.createQueue(queueName);
    
    const job = await queue.add(jobType, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: true,
      removeOnFail: false,
      ...opts
    });
    
    logger.info(`Added job to queue: ${queueName}, job ID: ${job.id}, type: ${jobType}`);
    return job.id!;
  }
  
  /**
   * Close all queues and workers
   */
  public async close(): Promise<void> {
    try {
      // Close all workers
      for (const [name, worker] of this.workers.entries()) {
        await worker.close();
        logger.info(`Worker closed: ${name}`);
      }
      
      // Close all queue events
      for (const [name, queueEvents] of this.queueEvents.entries()) {
        await queueEvents.close();
        logger.info(`Queue events closed: ${name}`);
      }
      
      // Close all queues
      for (const [name, queue] of this.queues.entries()) {
        await queue.close();
        logger.info(`Queue closed: ${name}`);
      }
      
      logger.info('All queues and workers closed');
    } catch (error) {
      logger.error(`Error closing queues and workers: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}