import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { createLogger } from './utils/logger';
import { setupRoutes } from './routes';
import { MinioService } from './services/minio-service';
import { RedisService } from './services/redis-service';
import { QueueService } from './services/queue-service';

const logger = createLogger('gateway');

/**
 * Initialize and start the gateway service
 */
async function startGateway() {
  logger.info('Starting gateway service');
  
  try {
    // Initialize services
    const minioService = new MinioService();
    const redisService = new RedisService();
    const queueService = new QueueService(redisService);
    
    // Ensure MinIO bucket exists
    await minioService.ensureBucket();
    
    // Create Express app
    const app = express();
    const port = process.env.PORT || 3001;
    
    // Middleware
    app.use(cors());
    app.use(bodyParser.json());
    
    // Request logging
    app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`);
      next();
    });
    
    // Set up routes with services
    const routes = setupRoutes(app, minioService, redisService, queueService);
    
    // Start server
    const server = app.listen(port, () => {
      logger.info(`Gateway service listening on port ${port}`);
    });
    
    // Set up WebSocket server
    if (routes.streamRoutes) {
      // Use type assertion to handle the custom property
      const streamRouter = routes.streamRoutes as any;
      if (streamRouter.setupWebSocketServer) {
        streamRouter.setupWebSocketServer(server);
        logger.info('WebSocket server initialized');
      }
    }
    
    // Handle shutdown signals
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down');
      await shutdown(server, queueService, redisService);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down');
      await shutdown(server, queueService, redisService);
    });
  } catch (error) {
    logger.error(`Error starting gateway service: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Gracefully shut down the gateway service
 */
async function shutdown(
  server: any,
  queueService: QueueService,
  redisService: RedisService
) {
  logger.info('Shutting down gateway service');
  
  try {
    // Close HTTP server
    server.close(() => {
      logger.info('HTTP server closed');
    });
    
    // Close queue connections
    await queueService.close();
    
    // Close Redis connections
    await redisService.close();
    
    logger.info('Gateway service shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error(`Error shutting down gateway service: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Start the gateway service if this file is run directly
if (require.main === module) {
  startGateway();
}

export { startGateway };