import { Express } from 'express';
import { createLogger } from '../utils/logger';
import testRoutes from './test-routes';

const logger = createLogger('routes');

/**
 * Sets up all API routes for the application
 * @param app Express application instance
 */
export const setupRoutes = (app: Express) => {
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
        { path: '/health', description: 'Health check endpoint' }
      ]
    });
  });
  
  // Register all route groups
  app.use(`${apiPrefix}/tests`, testRoutes);
  
  logger.info('Routes initialized');
};