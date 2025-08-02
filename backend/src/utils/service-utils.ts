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
  logger.info('Initializing services');
  
  // Initialize services
  const minioService = new MinioService();
  const redisService = new RedisService();
  const queueService = new QueueService(redisService);
  
  // Ensure MinIO bucket exists
  await minioService.ensureBucket();
  
  logger.info('Services initialized successfully');
  
  return {
    minioService,
    redisService,
    queueService
  };
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
  logger.info('Shutting down services');
  
  try {
    // Close queue connections
    await queueService.close();
    
    // Close Redis connections
    await redisService.close();
    
    logger.info('Services shut down successfully');
  } catch (error) {
    logger.error(`Error shutting down services: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}