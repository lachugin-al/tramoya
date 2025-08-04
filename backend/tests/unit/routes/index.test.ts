import express, { Express } from 'express';
import request from 'supertest';
import { setupRoutes } from '../../../src/routes/index';
import { MinioService } from '../../../src/services/minio-service';
import { RedisService } from '../../../src/services/redis-service';
import { QueueService } from '../../../src/services/queue-service';
import testRoutes from '../../../src/routes/test-routes';
import runRoutes from '../../../src/routes/run-routes';
import streamRoutes from '../../../src/routes/stream-routes';

// Mock dependencies
jest.mock('../../../src/utils/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

jest.mock('../../../src/routes/test-routes', () => jest.fn().mockReturnValue(express.Router()));
jest.mock('../../../src/routes/run-routes', () => jest.fn().mockReturnValue(express.Router()));
jest.mock('../../../src/routes/stream-routes', () => jest.fn().mockReturnValue(express.Router()));

describe('Routes Index', () => {
  let app: Express;
  let mockMinioService: jest.Mocked<MinioService>;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockQueueService: jest.Mocked<QueueService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock services
    mockMinioService = {} as jest.Mocked<MinioService>;
    mockRedisService = {} as jest.Mocked<RedisService>;
    mockQueueService = {} as jest.Mocked<QueueService>;

    // Create Express app
    app = express();
  });

  describe('setupRoutes', () => {
    it('should set up health check endpoint', async () => {
      // Set up routes
      setupRoutes(app, mockMinioService, mockRedisService, mockQueueService);

      // Test health check endpoint
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });

    it('should set up API documentation endpoint', async () => {
      // Set up routes
      setupRoutes(app, mockMinioService, mockRedisService, mockQueueService);

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
      setupRoutes(app, mockMinioService, mockRedisService, mockQueueService);

      // Verify route handlers were initialized with services
      expect(testRoutes).toHaveBeenCalledWith(mockMinioService, mockRedisService, mockQueueService);
      expect(runRoutes).toHaveBeenCalledWith(mockMinioService, mockRedisService, mockQueueService);
      expect(streamRoutes).toHaveBeenCalledWith(mockRedisService);
    });

    it('should register route handlers with the correct paths', () => {
      // Spy on app.use
      const useSpy = jest.spyOn(app, 'use');

      // Set up routes
      setupRoutes(app, mockMinioService, mockRedisService, mockQueueService);

      // Verify routes were registered with correct paths
      expect(useSpy).toHaveBeenCalledWith('/api/v1/tests', expect.any(Function));
      expect(useSpy).toHaveBeenCalledWith('/api/v1/runs', expect.any(Function));
      expect(useSpy).toHaveBeenCalledWith('/api/v1/stream', expect.any(Function));
    });

    it('should return route handlers for external access', () => {
      // Set up routes
      const result = setupRoutes(app, mockMinioService, mockRedisService, mockQueueService);

      // Verify result contains route handlers
      expect(result).toEqual({
        testRoutes: expect.any(Function),
        runRoutes: expect.any(Function),
        streamRoutes: expect.any(Function)
      });
    });
  });
});