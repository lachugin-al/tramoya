import { createLogger } from './utils/logger';
import { MinioService } from './services/minio-service';
import { RedisService } from './services/redis-service';
import { QueueService } from './services/queue-service';
import { RunnerWorker } from './services/runner-worker';

const logger = createLogger('runner');

/**
 * Initialize and start the runner service
 */
async function startRunner() {
  logger.info('Starting runner service');
  
  try {
    // Initialize services
    const minioService = new MinioService();
    const redisService = new RedisService();
    const queueService = new QueueService(redisService);
    
    // Ensure MinIO bucket exists
    await minioService.ensureBucket();
    
    // Create and start the runner worker
    const runnerWorker = new RunnerWorker(queueService, minioService, redisService);
    runnerWorker.start();
    
    logger.info('Runner service started');
    
    // Handle shutdown signals
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down');
      await shutdown(runnerWorker, queueService, redisService);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down');
      await shutdown(runnerWorker, queueService, redisService);
    });
  } catch (error) {
    logger.error(`Error starting runner service: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Gracefully shut down the runner service
 */
async function shutdown(
  runnerWorker: RunnerWorker,
  queueService: QueueService,
  redisService: RedisService
) {
  logger.info('Shutting down runner service');
  
  try {
    // Stop the runner worker
    await runnerWorker.stop();
    
    // Close queue connections
    await queueService.close();
    
    // Close Redis connections
    await redisService.close();
    
    logger.info('Runner service shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error(`Error shutting down runner service: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Start the runner service if this file is run directly
if (require.main === module) {
  startRunner();
}

export { startRunner };