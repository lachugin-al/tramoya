import {Job} from 'bullmq';
import {createLogger} from '../utils/logger';
import {QueueService, QUEUE_NAMES, ExecuteTestJobData, ExecuteTestJobResult, JobType} from './queue-service';
import {TestRunner} from './test-runner';
import {MinioService} from './minio-service';
import {RedisService} from './redis-service';
import {TestStatus} from '../models/test-result';
import os from 'os';

const logger = createLogger('runner-worker');

/**
 * Worker service that processes test execution jobs from the queue
 *
 * @class RunnerWorker
 * @description Manages the execution of test jobs by processing items from the test execution queue.
 * This service acts as a bridge between the queue system and the test runner, handling job lifecycle
 * and providing statistics about job execution.
 *
 * The RunnerWorker is responsible for:
 * - Processing test execution jobs from the queue
 * - Managing the TestRunner instance for actual test execution
 * - Tracking statistics about job execution (success/failure rates)
 * - Reporting memory usage and performance metrics
 * - Gracefully handling job failures and system shutdowns
 *
 * This service is designed to be run in a separate process or container to isolate
 * test execution from the main application.
 */
export class RunnerWorker {
    private queueService: QueueService;
    private testRunner: TestRunner;
    private jobsProcessed: number = 0;
    private jobsSucceeded: number = 0;
    private jobsFailed: number = 0;
    private startTime: number;

    /**
     * Creates a new RunnerWorker instance
     *
     * @constructor
     * @description Initializes a new RunnerWorker with the required services and creates
     * a TestRunner instance for executing tests. The constructor also records the start time
     * for uptime tracking and logs initialization metrics.
     *
     * @param {QueueService} queueService - Service for interacting with job queues
     * @param {MinioService} minioService - Service for storing test artifacts
     * @param {RedisService} redisService - Service for storing test results and publishing events
     */
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
     * Gets the current memory usage statistics
     *
     * @method getMemoryUsage
     * @description Collects and formats memory usage statistics from both the Node.js process
     * and the operating system. This information is used for monitoring resource usage
     * and diagnosing potential memory leaks or performance issues.
     *
     * The method returns memory values in megabytes (MB) for easier reading, including:
     * - Process memory statistics (RSS, heap total, heap used, external)
     * - System memory statistics (free memory, total memory)
     *
     * @returns {Object} An object containing formatted memory usage statistics
     * @private
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
     * Starts the worker and begins processing jobs from the queue
     *
     * @method start
     * @description Initializes the worker and begins processing jobs from the test execution queue.
     * This method performs the following actions:
     * 1. Creates a worker for the test execution queue using the queue service
     * 2. Registers the processJob method as the job processor
     * 3. Starts periodic statistics reporting
     *
     * Once started, the worker will automatically process jobs as they are added to the queue.
     * The worker will continue running until explicitly stopped with the stop() method.
     *
     * @returns {void}
     * @public
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
     * Starts periodic reporting of worker statistics
     *
     * @method startStatsReporting
     * @description Sets up a recurring timer that logs worker statistics at regular intervals.
     * This provides visibility into the worker's performance and resource usage over time.
     *
     * The statistics reported include:
     * - Worker uptime in minutes
     * - Number of jobs processed, succeeded, and failed
     * - Success rate as a percentage
     * - Memory usage statistics
     *
     * The statistics are logged every 5 minutes. The interval is automatically cleared
     * when the process exits to prevent memory leaks.
     *
     * @returns {void}
     * @private
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
     * Processes a test execution job from the queue
     *
     * @method processJob
     * @description Handles the execution of a test job retrieved from the queue.
     * This method is the core of the worker's functionality and is responsible for:
     *
     * 1. Extracting test data from the job
     * 2. Delegating test execution to the TestRunner
     * 3. Tracking job statistics (success/failure)
     * 4. Handling errors and generating appropriate error results
     * 5. Logging detailed information about the job execution
     *
     * If the test executes successfully, the method returns the test result.
     * If an error occurs during execution, the method creates and returns a
     * failure result with appropriate error status and empty step results.
     *
     * @param {Job<ExecuteTestJobData>} job - The job to process, containing test execution data
     * @returns {Promise<ExecuteTestJobResult>} A promise that resolves to the job execution result
     * @private
     */
    private async processJob(job: Job<ExecuteTestJobData>): Promise<ExecuteTestJobResult> {
        const {testId, runId, testScenario} = job.data;
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
     * Stops the worker and releases resources
     *
     * @method stop
     * @description Gracefully shuts down the worker and releases all resources.
     * This method performs the following actions:
     *
     * 1. Closes the browser instance used by the test runner
     * 2. Logs final statistics about the worker's performance
     * 3. Records timing information about the shutdown process
     *
     * This method should be called when the application is shutting down or
     * when the worker needs to be restarted. It ensures that all resources
     * are properly released to prevent memory leaks and orphaned processes.
     *
     * @returns {Promise<void>} A promise that resolves when the worker has been stopped
     * @public
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