import { createLogger } from './logger';
import { MinioService } from '../services/minio-service';
import { RedisService } from '../services/redis-service';
import { QueueService } from '../services/queue-service';

const logger = createLogger('service-utils');

/**
 * Initialize common services used by both gateway and runner
 * @returns Initialized services
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
        }
      }
    });
    
    return {
      minioService,
      redisService,
      queueService
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
 * Gracefully shut down services
 * @param queueService Queue service instance
 * @param redisService Redis service instance
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