import {createLogger} from './utils/logger';
import {RunnerWorker} from './services/runner-worker';
import {initializeServices, shutdownServices} from './utils/service-utils';
import os from 'os';

const logger = createLogger('runner');

/**
 * Initializes and starts the runner service.
 *
 * This function:
 * 1. Logs system information (node version, platform, architecture, etc.)
 * 2. Initializes required services (MinIO, Redis, Queue)
 * 3. Creates and starts a RunnerWorker instance
 * 4. Sets up event handlers for graceful shutdown
 * 5. Sets up error handling for uncaught exceptions and unhandled promise rejections
 * 6. Configures periodic logging of system statistics
 *
 * @async
 * @returns {Promise<void>} A promise that resolves when the runner service is started
 * @throws {Error} If there's an error during service initialization or startup
 */
async function startRunner() {
    logger.info('Starting runner service', {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        hostname: os.hostname(),
        cpus: os.cpus().length,
        memory: {
            total: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB`,
            free: `${Math.round(os.freemem() / (1024 * 1024 * 1024))}GB`
        }
    });

    const startTime = Date.now();

    try {
        // Initialize services
        logger.debug('Initializing services');
        const {minioService, redisService, queueService} = await initializeServices();
        logger.debug('Services initialized successfully', {
            serviceTypes: ['minio', 'redis', 'queue'],
            initTime: `${Date.now() - startTime}ms`
        });

        // Create and start the runner worker
        logger.debug('Creating runner worker');
        const runnerWorker = new RunnerWorker(queueService, minioService, redisService);

        logger.debug('Starting runner worker');
        const workerStartTime = Date.now();
        runnerWorker.start();
        logger.debug('Runner worker started', {
            startTime: `${Date.now() - workerStartTime}ms`
        });

        const totalStartupTime = Date.now() - startTime;
        logger.info('Runner service started', {
            startupTime: `${totalStartupTime}ms`,
            env: process.env.NODE_ENV || 'development'
        });

        // Handle shutdown signals
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT, shutting down');
            await shutdown(runnerWorker, queueService, redisService);
        });

        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM, shutting down');
            await shutdown(runnerWorker, queueService, redisService);
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception', {
                error: error.message,
                stack: error.stack
            });
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled promise rejection', {
                reason: reason instanceof Error ? reason.message : String(reason),
                stack: reason instanceof Error ? reason.stack : undefined
            });
        });

        // Log system stats periodically
        const statsInterval = setInterval(() => {
            logger.verbose('System stats', {
                memory: {
                    total: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB`,
                    free: `${Math.round(os.freemem() / (1024 * 1024 * 1024))}GB`,
                    usage: `${Math.round((1 - os.freemem() / os.totalmem()) * 100)}%`
                },
                uptime: `${Math.round(process.uptime())}s`,
                loadAvg: os.loadavg()
            });
        }, 60000); // Log every minute

        // Clear interval on shutdown
        process.on('exit', () => {
            clearInterval(statsInterval);
        });
    } catch (error) {
        logger.error('Error starting runner service', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            startupTime: `${Date.now() - startTime}ms`
        });
        process.exit(1);
    }
}

/**
 * Gracefully shuts down the runner service.
 *
 * This function:
 * 1. Stops the runner worker
 * 2. Closes connections to external services (Queue, Redis)
 * 3. Logs the shutdown status
 * 4. Exits the process
 *
 * @async
 * @param {RunnerWorker} runnerWorker - The runner worker instance to stop
 * @param {any} queueService - The queue service instance to shut down
 * @param {any} redisService - The Redis service instance to shut down
 * @returns {Promise<void>} A promise that resolves when the shutdown is complete
 * @throws {Error} If there's an error during the shutdown process
 */
async function shutdown(
    runnerWorker: RunnerWorker,
    queueService: any,
    redisService: any
) {
    logger.info('Shutting down runner service');

    try {
        // Stop the runner worker
        await runnerWorker.stop();

        // Close service connections
        await shutdownServices(queueService, redisService);

        logger.info('Runner service shut down successfully');
        process.exit(0);
    } catch (error) {
        logger.error(`Error shutting down runner service: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}

export {startRunner};