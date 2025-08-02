import { createLogger } from './utils/logger';
import { RunnerWorker } from './services/runner-worker';
import { initializeServices, shutdownServices } from './utils/service-utils';

const logger = createLogger('runner');

/**
 * Initialize and start the runner service
 */
async function startRunner() {
  logger.info('Starting runner service');
  
  try {
    // Initialize services
    const { minioService, redisService, queueService } = await initializeServices();
    
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

export { startRunner };