import {createLogger} from './logger';
import {MinioService} from '../services/minio-service';
import {RedisService} from '../services/redis-service';
import {QueueService} from '../services/queue-service';
import {initPrisma, disconnectPrisma} from '../services/prisma-service';

/**
 * Logger instance for service utilities
 * @private
 */
const logger = createLogger('service-utils');

/**
 * Initializes and configures all common services required by the application
 * This function handles the initialization of MinIO, Redis, Queue, and Prisma services,
 * ensuring they are properly configured and ready to use. It also ensures that
 * required resources like MinIO buckets exist.
 *
 * @returns {Promise<{
 *   minioService: MinioService,
 *   redisService: RedisService,
 *   queueService: QueueService,
 *   prisma: PrismaClient
 * }>} Object containing initialized service instances
 *
 * @throws {Error} If any service fails to initialize properly
 *
 * @example
 * // In your application startup code:
 * import { initializeServices } from './utils/service-utils';
 *
 * async function startApp() {
 *   try {
 *     const { minioService, redisService, queueService, prisma } = await initializeServices();
 *     // Services are now ready to use
 *     // Continue with application startup...
 *   } catch (error) {
 *     console.error('Failed to initialize services:', error);
 *     process.exit(1);
 *   }
 * }
 *
 * @description
 * This function initializes services with the following configuration:
 * - MinIO: Uses MINIO_ENDPOINT and MINIO_BUCKET environment variables
 * - Redis: Uses REDIS_HOST and REDIS_PORT environment variables
 * - Queue: Creates a queue named 'tramoya-queue'
 * - Prisma: Uses DATABASE_URL environment variable for database connection
 *
 * The function logs detailed timing information for each initialization step
 * and provides comprehensive error handling.
 */
export async function initializeServices() {
    const startTime = Date.now();
    logger.info('Initializing services');

    try {
        // Initialize MinIO service
        logger.debug('Initializing MinIO service');
        const minioStartTime = Date.now();
        const minioService = new MinioService();
        logger.debug('MinIO service initialized', {
            initTime: `${Date.now() - minioStartTime}ms`
        });

        // Initialize Redis service
        logger.debug('Initializing Redis service');
        const redisStartTime = Date.now();
        const redisService = new RedisService();
        logger.debug('Redis service initialized', {
            initTime: `${Date.now() - redisStartTime}ms`
        });

        // Initialize Queue service
        logger.debug('Initializing Queue service');
        const queueStartTime = Date.now();
        const queueService = new QueueService(redisService);
        logger.debug('Queue service initialized', {
            initTime: `${Date.now() - queueStartTime}ms`
        });

        // Ensure MinIO bucket exists
        logger.debug('Ensuring MinIO bucket exists');
        const bucketStartTime = Date.now();
        await minioService.ensureBucket();
        logger.debug('MinIO bucket ensured', {
            initTime: `${Date.now() - bucketStartTime}ms`
        });

        // Initialize Prisma client
        logger.debug('Initializing Prisma client');
        const prismaStartTime = Date.now();
        const prisma = await initPrisma();
        logger.debug('Prisma client initialized', {
            initTime: `${Date.now() - prismaStartTime}ms`
        });

        const totalTime = Date.now() - startTime;
        logger.info('Services initialized successfully', {
            totalTime: `${totalTime}ms`,
            services: {
                minio: {
                    endpoint: process.env.MINIO_ENDPOINT || 'localhost:9000',
                    bucket: process.env.MINIO_BUCKET || 'tramoya'
                },
                redis: {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: process.env.REDIS_PORT || 6379
                },
                queue: {
                    name: 'tramoya-queue'
                },
                prisma: {
                    url: process.env.DATABASE_URL ? 'configured' : 'not configured'
                }
            }
        });

        return {
            minioService,
            redisService,
            queueService,
            prisma
        };
    } catch (error) {
        logger.error('Error initializing services', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            initTime: `${Date.now() - startTime}ms`
        });
        throw error;
    }
}

/**
 * Gracefully shuts down all initialized services
 * This function ensures that all services are properly closed before application exit,
 * preventing resource leaks, data corruption, and allowing for clean process termination.
 *
 * @param {QueueService} queueService - The Queue service instance to shut down
 * @param {RedisService} redisService - The Redis service instance to shut down
 * @returns {Promise<void>} A promise that resolves when all services are shut down
 * @throws {Error} If any service fails to shut down properly
 *
 * @example
 * // In your application shutdown code:
 * import { shutdownServices } from './utils/service-utils';
 *
 * async function stopApp() {
 *   try {
 *     await shutdownServices(queueService, redisService);
 *     console.log('Application shut down successfully');
 *     process.exit(0);
 *   } catch (error) {
 *     console.error('Error during shutdown:', error);
 *     process.exit(1);
 *   }
 * }
 *
 * // Handle termination signals
 * process.on('SIGTERM', stopApp);
 * process.on('SIGINT', stopApp);
 *
 * @description
 * The function performs the following shutdown sequence:
 * 1. Closes the Queue service connections first
 * 2. Closes the Redis service connections next
 * 3. Disconnects the Prisma client
 *
 * The function logs detailed timing information for each shutdown step
 * and provides comprehensive error handling.
 */
export async function shutdownServices(
    queueService: QueueService,
    redisService: RedisService
) {
    const startTime = Date.now();
    logger.info('Shutting down services');

    try {
        // Close queue connections
        logger.debug('Closing queue connections');
        const queueCloseTime = Date.now();
        await queueService.close();
        logger.debug('Queue connections closed', {
            closeTime: `${Date.now() - queueCloseTime}ms`
        });

        // Close Redis connections
        logger.debug('Closing Redis connections');
        const redisCloseTime = Date.now();
        await redisService.close();
        logger.debug('Redis connections closed', {
            closeTime: `${Date.now() - redisCloseTime}ms`
        });

        // Disconnect Prisma client
        logger.debug('Disconnecting Prisma client');
        const prismaCloseTime = Date.now();
        await disconnectPrisma();
        logger.debug('Prisma client disconnected', {
            closeTime: `${Date.now() - prismaCloseTime}ms`
        });

        const totalTime = Date.now() - startTime;
        logger.info('Services shut down successfully', {
            totalTime: `${totalTime}ms`
        });
    } catch (error) {
        logger.error('Error shutting down services', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            shutdownTime: `${Date.now() - startTime}ms`
        });
        throw error;
    }
}