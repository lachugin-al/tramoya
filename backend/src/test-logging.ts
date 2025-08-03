/**
 * Test script to verify that the logging system works as expected.
 * 
 * This script:
 * 1. Creates loggers for different modules
 * 2. Logs messages at different levels
 * 3. Simulates a request with request ID tracking
 * 4. Simulates an error condition
 * 5. Logs performance metrics
 * 
 * Run with: npx ts-node src/test-logging.ts
 */

import { createLogger, requestIdMiddleware } from './utils/logger';
import * as http from 'http';
import express from 'express';

// Create loggers for different modules
const mainLogger = createLogger('test-logging');
const serviceLogger = createLogger('test-service');
const apiLogger = createLogger('test-api');

// Log at different levels
mainLogger.info('Starting logging test');
mainLogger.debug('This is a debug message');
mainLogger.verbose('This is a verbose message');
mainLogger.http('This is an HTTP message');
mainLogger.warn('This is a warning message');
mainLogger.error('This is an error message');
mainLogger.trace('This is a trace message');

// Log with context
mainLogger.info('Context example', {
  environment: process.env.NODE_ENV || 'development',
  nodeVersion: process.version,
  timestamp: new Date().toISOString()
});

// Simulate a service operation with timing
serviceLogger.info('Starting service operation');
const startTime = Date.now();

// Simulate some work
setTimeout(() => {
  const duration = Date.now() - startTime;
  serviceLogger.info('Service operation completed', {
    duration: `${duration}ms`,
    result: 'success'
  });

  // Simulate an error
  try {
    throw new Error('Test error');
  } catch (error) {
    serviceLogger.error('Service operation failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration: `${Date.now() - startTime}ms`
    });
  }

  // Test request ID middleware
  testRequestIdMiddleware();
}, 1000);

/**
 * Tests the request ID middleware functionality by creating a simple Express server,
 * adding the middleware, and making a test request.
 * 
 * This function:
 * 1. Creates an Express application
 * 2. Adds the request ID middleware
 * 3. Sets up a test route
 * 4. Starts the server on a random port
 * 5. Makes a test request to the server
 * 6. Logs the response
 * 7. Closes the server when done
 * 
 * @returns {void}
 */
function testRequestIdMiddleware() {
  mainLogger.info('Testing request ID middleware');
  
  // Create a simple Express app
  const app = express();
  
  // Add request ID middleware
  app.use(requestIdMiddleware);
  
  // Add a test route
  app.get('/test', (req, res) => {
    apiLogger.info('Received test request', {
      path: req.path,
      method: req.method,
      headers: req.headers
    });
    
    res.json({ message: 'Test successful' });
  });
  
  // Start the server
  const server = app.listen(0, () => {
    const address = server.address() as { port: number };
    const port = address.port;
    mainLogger.info(`Test server listening on port ${port}`);
    
    // Make a test request
    http.get(`http://localhost:${port}/test`, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        apiLogger.info('Test request completed', {
          statusCode: res.statusCode,
          headers: res.headers,
          data
        });
        
        // Close the server
        server.close(() => {
          mainLogger.info('Test server closed');
          mainLogger.info('Logging test completed');
          
          // Log memory usage
          const memoryUsage = process.memoryUsage();
          mainLogger.info('Memory usage', {
            rss: `${Math.round(memoryUsage.rss / (1024 * 1024))}MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / (1024 * 1024))}MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / (1024 * 1024))}MB`,
            external: `${Math.round(memoryUsage.external / (1024 * 1024))}MB`
          });
        });
      });
    }).on('error', (err) => {
      apiLogger.error('Test request failed', {
        error: err.message,
        stack: err.stack
      });
    });
  });
}