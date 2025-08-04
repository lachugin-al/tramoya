import {Queue, Worker, Job, QueueEvents} from 'bullmq';
import {RedisService} from './redis-service';
import {createLogger} from '../utils/logger';
import {TestScenario} from '../models/test-scenario';
import {TestResult} from '../models/test-result';

const logger = createLogger('queue-service');

/**
 * Predefined queue names used throughout the application
 *
 * @constant
 * @type {Object}
 * @property {string} TEST_EXECUTION - Queue for test execution jobs
 */
export const QUEUE_NAMES = {
    TEST_EXECUTION: 'test-execution'
};

/**
 * Predefined event channel names for Redis pub/sub communication
 *
 * @constant
 * @type {Object}
 * @property {string} TEST_EVENTS - Channel for test-related events
 */
export const EVENT_CHANNELS = {
    TEST_EVENTS: 'test-events'
};

/**
 * Enumeration of job types supported by the queue system
 *
 * @enum {string}
 * @readonly
 */
export enum JobType {
    /** Job type for executing a test scenario */
    EXECUTE_TEST = 'execute-test'
}

/**
 * Interface for the data required to execute a test
 *
 * @interface ExecuteTestJobData
 * @property {string} testId - Unique identifier for the test
 * @property {string} runId - Unique identifier for this specific test run
 * @property {TestScenario} testScenario - The test scenario to execute
 */
export interface ExecuteTestJobData {
    testId: string;
    runId: string;
    testScenario: TestScenario;
}

/**
 * Interface for the result of an executed test
 *
 * @interface ExecuteTestJobResult
 * @property {string} runId - Unique identifier for the test run
 * @property {TestResult} testResult - The result of the test execution
 */
export interface ExecuteTestJobResult {
    runId: string;
    testResult: TestResult;
}

/**
 * Service for managing distributed job queues using BullMQ
 *
 * @class QueueService
 * @description Provides methods for creating and managing job queues, workers, and jobs.
 * This service uses BullMQ, a Redis-based queue system, to handle distributed job processing.
 * It supports job scheduling, retries, backoff strategies, and event handling.
 *
 * The QueueService maintains:
 * - A collection of queues for different job types
 * - Workers that process jobs from the queues
 * - Queue event listeners for monitoring job status
 *
 * This service is primarily used for:
 * - Scheduling and executing test runs
 * - Managing background processing tasks
 * - Handling distributed workloads across multiple processes or servers
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
     * Creates or retrieves a BullMQ queue with the specified name
     *
     * @method createQueue
     * @description Creates a new BullMQ queue with the specified name, or returns an existing queue
     * if one with the same name already exists. The method also sets up queue event listeners
     * to monitor job completion, failures, and stalled jobs.
     *
     * The queue uses the Redis connection from the RedisService for storage and communication.
     *
     * @param {string} name - The name of the queue to create or retrieve
     * @returns {Queue} The created or existing queue instance
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
        queueEvents.on('completed', ({jobId, returnvalue}) => {
            logger.info(`Job completed: ${jobId}`);
        });

        queueEvents.on('failed', ({jobId, failedReason}) => {
            logger.error(`Job failed: ${jobId}, reason: ${failedReason}`);
        });

        queueEvents.on('stalled', ({jobId}) => {
            logger.warn(`Job stalled: ${jobId}`);
        });

        return queue;
    }

    /**
     * Retrieves an existing queue by its name
     *
     * @method getQueue
     * @description Returns a previously created queue instance with the specified name.
     * If no queue with the given name exists, the method returns undefined.
     *
     * Unlike createQueue(), this method does not create a new queue if one doesn't exist.
     *
     * @param {string} name - The name of the queue to retrieve
     * @returns {Queue|undefined} The queue instance if found, or undefined if not found
     */
    public getQueue(name: string): Queue | undefined {
        return this.queues.get(name);
    }

    /**
     * Creates a worker to process jobs from a specific queue
     *
     * @method createWorker
     * @description Creates a new BullMQ worker that processes jobs from the specified queue.
     * If a worker for the queue already exists, it returns the existing worker.
     * The worker uses the provided processor function to handle jobs and sets up event listeners
     * for job completion, failures, and worker errors.
     *
     * Workers are responsible for executing the actual job logic defined in the processor function.
     *
     * @template T - The type of data contained in the job
     * @template R - The type of result returned by the job processor
     * @param {string} queueName - The name of the queue to process jobs from
     * @param {Function} processor - The function that processes each job
     * @param {Job<T>} processor.job - The job object containing data and metadata
     * @returns {Worker<T, R>} The created or existing worker instance
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
     * Adds a new job to a specified queue
     *
     * @method addJob
     * @description Creates and adds a new job to the specified queue with the given type and data.
     * If the queue doesn't exist, it will be created automatically.
     *
     * The method applies default job options including:
     * - 3 retry attempts
     * - Exponential backoff strategy starting at 1 second
     * - Automatic removal of completed jobs
     * - Retention of failed jobs for inspection
     *
     * These defaults can be overridden by providing custom options in the opts parameter.
     *
     * @template T - The type of data to be stored in the job
     * @param {string} queueName - The name of the queue to add the job to
     * @param {string} jobType - The type of job (used for job identification and routing)
     * @param {T} data - The data to be processed by the job
     * @param {Object} [opts={}] - Optional BullMQ job options to override defaults
     * @returns {Promise<string>} A promise that resolves to the ID of the created job
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
     * Gracefully closes all queues, workers, and queue event listeners
     *
     * @method close
     * @description Properly shuts down all BullMQ components managed by this service.
     * This includes closing all workers, queue event listeners, and queues.
     *
     * The method follows a specific shutdown order to ensure clean termination:
     * 1. First, all workers are closed to stop processing new jobs
     * 2. Then, all queue event listeners are closed to stop monitoring events
     * 3. Finally, all queues are closed to release resources
     *
     * This method handles errors internally and logs them without throwing exceptions
     * to ensure the shutdown process continues even if some components fail to close.
     *
     * @returns {Promise<void>} A promise that resolves when all components have been closed
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