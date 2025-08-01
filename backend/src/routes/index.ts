import { Express } from 'express';
import { createLogger } from '../utils/logger';
import { MinioService } from '../services/minio-service';
import { RedisService } from '../services/redis-service';
import { QueueService } from '../services/queue-service';
import testRoutes from './test-routes';
import runRoutes from './run-routes';
import streamRoutes from './stream-routes';

const logger = createLogger('routes');

/**
 * Sets up all API routes for the application
 * @param app Express application instance
 * @param minioService MinIO service instance
 * @param redisService Redis service instance
 * @param queueService Queue service instance
 */
export const setupRoutes = (
  app: Express,
  minioService: MinioService,
  redisService: RedisService,
  queueService: QueueService
) => {
  // API version prefix
  const apiPrefix = '/api/v1';
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  
  // API documentation endpoint
  app.get('/api', (req, res) => {
    res.status(200).json({
      message: 'Tramoya API',
      version: '1.0.0',
      endpoints: [
        { path: '/api/v1/tests', description: 'Test management endpoints' },
        { path: '/api/v1/runs', description: 'Test run management endpoints' },
        { path: '/api/v1/stream', description: 'Real-time streaming endpoints' },
        { path: '/health', description: 'Health check endpoint' }
      ]
    });
  });
  
  // Create route handlers with services
  const testRoutesHandler = testRoutes(minioService, redisService, queueService);
  const runRoutesHandler = runRoutes(minioService, redisService, queueService);
  const streamRoutesHandler = streamRoutes(redisService);
  
  // Register all route groups
  app.use(`${apiPrefix}/tests`, testRoutesHandler);
  app.use(`${apiPrefix}/runs`, runRoutesHandler);
  app.use(`${apiPrefix}/stream`, streamRoutesHandler);
  
  logger.info('Routes initialized');
  
  // Return route handlers for external access (e.g., WebSocket setup)
  return {
    testRoutes: testRoutesHandler,
    runRoutes: runRoutesHandler,
    streamRoutes: streamRoutesHandler
  };
};