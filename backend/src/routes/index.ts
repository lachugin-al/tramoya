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
 * 
 * This function initializes and configures all API routes for the Tramoya application.
 * It creates route handlers for test scenarios, test runs, and real-time streaming,
 * and registers them with the Express application. It also sets up utility endpoints
 * like health check and API documentation.
 * 
 * @param {Express} app - Express application instance to register routes with
 * @param {MinioService} minioService - Service for object storage operations
 * @param {RedisService} redisService - Service for Redis operations and pub/sub
 * @param {QueueService} queueService - Service for job queue management
 * @returns {Object} Object containing references to all route handlers for external access
 * @returns {Router} returns.testRoutes - Router for test scenario management endpoints
 * @returns {Router} returns.runRoutes - Router for test run management endpoints
 * @returns {Router} returns.streamRoutes - Router for real-time streaming endpoints
 */
export const setupRoutes = (
  app: Express,
  minioService: MinioService,
  redisService: RedisService,
  queueService: QueueService
) => {
  // API version prefix
  const apiPrefix = '/api/v1';
  
  /**
   * GET /health
   * Health check endpoint for monitoring and load balancers
   * 
   * This endpoint provides a simple way to check if the API is running and responsive.
   * It can be used by monitoring tools, load balancers, or container orchestration systems
   * to verify the health of the service.
   * 
   * @route GET /health
   * @returns {Object} Object with status information
   * @returns {string} returns.status - Always "ok" when the service is healthy
   */
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  
  /**
   * GET /api
   * API documentation endpoint
   * 
   * This endpoint provides basic information about the API, including its version
   * and available endpoints. It serves as a simple API discovery mechanism and
   * entry point for developers exploring the API.
   * 
   * @route GET /api
   * @returns {Object} Object with API information
   * @returns {string} returns.message - API name
   * @returns {string} returns.version - API version
   * @returns {Object[]} returns.endpoints - Array of available endpoints
   * @returns {string} returns.endpoints[].path - Endpoint path
   * @returns {string} returns.endpoints[].description - Endpoint description
   */
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
  
  /**
   * Return route handlers for external access
   * 
   * This object provides access to the configured route handlers, allowing other parts
   * of the application to access them directly. This is particularly useful for setting
   * up WebSocket servers that need to be attached to the HTTP server but configured
   * through the route handlers.
   * 
   * @returns {Object} Object containing references to all route handlers
   * @returns {Router} testRoutes - Router for test scenario management endpoints
   * @returns {Router} runRoutes - Router for test run management endpoints
   * @returns {Router} streamRoutes - Router for real-time streaming endpoints with WebSocket setup
   */
  return {
    testRoutes: testRoutesHandler,
    runRoutes: runRoutesHandler,
    streamRoutes: streamRoutesHandler
  };
};