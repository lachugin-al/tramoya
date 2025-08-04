import express, { Express } from 'express';
import request from 'supertest';
import { setupRoutes } from '../../../src/routes/index';
import { MinioService } from '../../../src/services/minio-service';
import { RedisService } from '../../../src/services/redis-service';
import { QueueService } from '../../../src/services/queue-service';
import testRoutes from '../../../src/routes/test-routes';
import runRoutes from '../../../src/routes/run-routes';
import streamRoutes from '../../../src/routes/stream-routes';

// Partially mock the services and routes
jest.mock('../../../src/services/minio-service', () => {
  return {
    MinioService: jest.fn().mockImplementation(() => ({}))
  };
});

jest.mock('../../../src/services/redis-service', () => {
  return {
    RedisService: jest.fn().mockImplementation(() => ({}))
  };
});

jest.mock('../../../src/services/queue-service', () => {
  return {
    QueueService: jest.fn().mockImplementation((redisService) => ({})),
    QUEUE_NAMES: {
      TEST_EXECUTION: 'test-execution'
    }
  };
});

// Mock the route handlers to return simple routers
jest.mock('../../../src/routes/test-routes', () => {
  return jest.fn().mockImplementation(() => {
    const router = express.Router();
    router.get('/test', (req, res) => res.status(200).json({ route: 'test' }));
    return router;
  });
});

jest.mock('../../../src/routes/run-routes', () => {
  return jest.fn().mockImplementation(() => {
    const router = express.Router();
    router.get('/test', (req, res) => res.status(200).json({ route: 'run' }));
    return router;
  });
});

jest.mock('../../../src/routes/stream-routes', () => {
  return jest.fn().mockImplementation(() => {
    const router = express.Router();
    router.get('/test', (req, res) => res.status(200).json({ route: 'stream' }));
    return router;
  });
});

describe('Routes Index Integration Tests', () => {
  let app: Express;
  let minioService: MinioService;
  let redisService: RedisService;
  let queueService: QueueService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create services
    minioService = new MinioService();
    redisService = new RedisService();
    queueService = new QueueService(redisService);
    
    // Create Express app
    app = express();
  });
  
  describe('setupRoutes', () => {
    it('should set up health check endpoint', async () => {
      // Set up routes
      setupRoutes(app, minioService, redisService, queueService);
      
      // Test health check endpoint
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
    
    it('should set up API documentation endpoint', async () => {
      // Set up routes
      setupRoutes(app, minioService, redisService, queueService);
      
      // Test API documentation endpoint
      const response = await request(app).get('/api');
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        message: 'Tramoya API',
        version: '1.0.0',
        endpoints: expect.arrayContaining([
          expect.objectContaining({ path: '/api/v1/tests' }),
          expect.objectContaining({ path: '/api/v1/runs' }),
          expect.objectContaining({ path: '/api/v1/stream' }),
          expect.objectContaining({ path: '/health' })
        ])
      });
    });
    
    it('should initialize route handlers with services', () => {
      // Set up routes
      setupRoutes(app, minioService, redisService, queueService);
      
      // Verify route handlers were initialized with services
      expect(testRoutes).toHaveBeenCalledWith(minioService, redisService, queueService);
      expect(runRoutes).toHaveBeenCalledWith(minioService, redisService, queueService);
      expect(streamRoutes).toHaveBeenCalledWith(redisService);
    });
    
    it('should register route handlers with the correct paths', async () => {
      // Set up routes
      setupRoutes(app, minioService, redisService, queueService);
      
      // Test test routes
      const testResponse = await request(app).get('/api/v1/tests/test');
      expect(testResponse.status).toBe(200);
      expect(testResponse.body).toEqual({ route: 'test' });
      
      // Test run routes
      const runResponse = await request(app).get('/api/v1/runs/test');
      expect(runResponse.status).toBe(200);
      expect(runResponse.body).toEqual({ route: 'run' });
      
      // Test stream routes
      const streamResponse = await request(app).get('/api/v1/stream/test');
      expect(streamResponse.status).toBe(200);
      expect(streamResponse.body).toEqual({ route: 'stream' });
    });
    
    it('should return route handlers for external access', () => {
      // Set up routes
      const result = setupRoutes(app, minioService, redisService, queueService);
      
      // Verify result contains route handlers
      expect(result).toEqual({
        testRoutes: expect.any(Function),
        runRoutes: expect.any(Function),
        streamRoutes: expect.any(Function)
      });
    });
  });
  
  describe('Integration with Express app', () => {
    it('should integrate with Express middleware', async () => {
      // Add a middleware before routes
      app.use((req, res, next) => {
        (req as any).customData = 'test-data';
        next();
      });
      
      // Set up routes
      setupRoutes(app, minioService, redisService, queueService);
      
      // Add a middleware after routes to check custom data
      app.use('/custom', (req, res) => {
        res.status(200).json({ customData: (req as any).customData });
      });
      
      // Test custom endpoint
      const response = await request(app).get('/custom');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ customData: 'test-data' });
    });
    
    it('should handle 404 for non-existent routes', async () => {
      // Set up routes
      setupRoutes(app, minioService, redisService, queueService);
      
      // Test non-existent route
      const response = await request(app).get('/non-existent');
      
      expect(response.status).toBe(404);
    });
  });
});