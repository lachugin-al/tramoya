import express from 'express';
import request from 'supertest';
import { createLogger, requestIdMiddleware, getRequestId } from '../../../src/utils/logger';
import fs from 'fs';
import path from 'path';

// We need to reset the mocks from the global setup
jest.unmock('../../../src/utils/logger');

describe('Logger Integration Tests', () => {
  const logDir = 'test-logs';
  let originalEnv: NodeJS.ProcessEnv;
  
  beforeAll(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set environment variables for testing
    process.env.LOG_DIR = logDir;
    process.env.LOG_LEVEL = 'debug';
    
    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  });
  
  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
    
    // Clean up test log files
    if (fs.existsSync(logDir)) {
      const files = fs.readdirSync(logDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(logDir, file));
      });
      fs.rmdirSync(logDir);
    }
  });
  
  describe('createLogger', () => {
    it('should create a logger that writes to log files', async () => {
      // Create a logger
      const logger = createLogger('integration-test');
      
      // Log some messages
      logger.info('Test info message');
      logger.error('Test error message');
      logger.debug('Test debug message');
      
      // Wait for file writes to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify log files were created
      expect(fs.existsSync(path.join(logDir, 'combined.log'))).toBe(true);
      expect(fs.existsSync(path.join(logDir, 'error.log'))).toBe(true);
      expect(fs.existsSync(path.join(logDir, 'debug.log'))).toBe(true);
      
      // Verify log content
      const combinedLog = fs.readFileSync(path.join(logDir, 'combined.log'), 'utf8');
      const errorLog = fs.readFileSync(path.join(logDir, 'error.log'), 'utf8');
      const debugLog = fs.readFileSync(path.join(logDir, 'debug.log'), 'utf8');
      
      expect(combinedLog).toContain('Test info message');
      expect(combinedLog).toContain('Test error message');
      expect(errorLog).toContain('Test error message');
      expect(debugLog).toContain('Test debug message');
    });
    
    it('should include module name in log entries', async () => {
      // Create a logger with a specific module name
      const moduleName = 'custom-module';
      const logger = createLogger(moduleName);
      
      // Log a message
      logger.info('Module name test');
      
      // Wait for file writes to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify log content
      const combinedLog = fs.readFileSync(path.join(logDir, 'combined.log'), 'utf8');
      
      expect(combinedLog).toContain(moduleName);
      expect(combinedLog).toContain('Module name test');
    });
    
    it('should support trace level logging', async () => {
      // Create a logger
      const logger = createLogger('trace-test');
      
      // Log a trace message
      logger.trace('Test trace message');
      
      // Wait for file writes to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify log content
      const debugLog = fs.readFileSync(path.join(logDir, 'debug.log'), 'utf8');
      
      expect(debugLog).toContain('Test trace message');
    });
  });
  
  describe('requestIdMiddleware', () => {
    it('should add request ID to response headers', async () => {
      // Create Express app with middleware
      const app = express();
      app.use(requestIdMiddleware);
      app.get('/test', (req, res) => {
        res.status(200).send('OK');
      });
      
      // Make a request
      const response = await request(app).get('/test');
      
      // Verify response has request ID header
      expect(response.headers['x-request-id']).toBeDefined();
    });
    
    it('should use existing request ID from headers if available', async () => {
      // Create Express app with middleware
      const app = express();
      app.use(requestIdMiddleware);
      app.get('/test', (req, res) => {
        res.status(200).send('OK');
      });
      
      // Make a request with a request ID
      const requestId = 'existing-request-id';
      const response = await request(app)
        .get('/test')
        .set('x-request-id', requestId);
      
      // Verify response has the same request ID
      expect(response.headers['x-request-id']).toBe(requestId);
    });
    
    it('should make request ID available via getRequestId', async () => {
      // Create Express app with middleware
      const app = express();
      app.use(requestIdMiddleware);
      app.get('/test', (req, res) => {
        const requestId = getRequestId();
        res.status(200).json({ requestId });
      });
      
      // Make a request with a request ID
      const requestId = 'test-request-id';
      const response = await request(app)
        .get('/test')
        .set('x-request-id', requestId);
      
      // Verify getRequestId returns the correct ID
      expect(response.body.requestId).toBe(requestId);
    });
  });
});