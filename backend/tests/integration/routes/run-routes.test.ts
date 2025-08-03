import express, { Express } from 'express';
import request from 'supertest';
import runRoutes from '../../../src/routes/run-routes';
import { MinioService } from '../../../src/services/minio-service';
import { RedisService } from '../../../src/services/redis-service';
import { QueueService, QUEUE_NAMES, JobType } from '../../../src/services/queue-service';
import { TestStatus } from '../../../src/models/test-result';
import { v4 as uuidv4 } from 'uuid';

// Mock uuid to return predictable values
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid')
}));

// Partially mock the services
jest.mock('../../../src/services/minio-service', () => {
  return {
    MinioService: jest.fn().mockImplementation(() => ({
      getObject: jest.fn(),
      putObject: jest.fn(),
      listObjects: jest.fn(),
      deleteObject: jest.fn()
    }))
  };
});

jest.mock('../../../src/services/redis-service', () => {
  return {
    RedisService: jest.fn().mockImplementation(() => ({
      getTestResult: jest.fn(),
      saveTestResult: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn()
    }))
  };
});

jest.mock('../../../src/services/queue-service', () => {
  const QUEUE_NAMES = {
    TEST_EXECUTION: 'test-execution'
  };
  
  const JobType = {
    EXECUTE_TEST: 'execute-test'
  };
  
  return {
    QueueService: jest.fn().mockImplementation((redisService) => ({
      addJob: jest.fn().mockResolvedValue({ id: 'job-123' })
    })),
    QUEUE_NAMES,
    JobType
  };
});

describe('Run Routes Integration Tests', () => {
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
    app.use(express.json());
    app.use('/runs', runRoutes(minioService, redisService, queueService));
  });
  
  describe('GET /runs', () => {
    it('should return all test runs', async () => {
      // Test endpoint
      const response = await request(app).get('/runs');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
  
  describe('GET /runs/:id', () => {
    it('should return 404 if test run is not found', async () => {
      // Test endpoint for a non-existent run
      const response = await request(app).get('/runs/nonexistent');
      
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Test run not found' });
    });
  });
  
  
  describe('POST /runs', () => {
    it('should create a new test run', async () => {
      // Test data
      const testData = {
        testId: 'test-123',
        testScenario: {
          id: 'test-123',
          name: 'Test Scenario',
          steps: []
        }
      };
      
      // Test endpoint
      const response = await request(app)
        .post('/runs')
        .send(testData);
      
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        message: 'Test run created',
        runId: expect.any(String),
        result: expect.objectContaining({
          status: TestStatus.RUNNING
        })
      });
      
      // Verify job was added to queue
      expect(queueService.addJob).toHaveBeenCalledWith(
        QUEUE_NAMES.TEST_EXECUTION,
        JobType.EXECUTE_TEST,
        expect.objectContaining({
          testId: 'test-123',
          runId: expect.any(String),
          testScenario: expect.any(Object)
        })
      );
    });
    
    it('should return 400 if required fields are missing', async () => {
      // Test endpoint with missing fields
      const response = await request(app)
        .post('/runs')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Test ID and test scenario are required' });
    });
  });

  describe('DELETE /runs/:id', () => {
    it('should return 404 if test run to delete is not found', async () => {
      // Test endpoint for a non-existent run
      const response = await request(app).delete('/runs/nonexistent');
      
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Test run not found' });
    });
  });
  
  describe('GET /runs/:id/artifacts/:type', () => {
    it('should return 404 if test run is not found', async () => {
      // Test endpoint for a non-existent run
      const response = await request(app).get('/runs/nonexistent/artifacts/video');
      
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Test run not found' });
    });
    
    it('should return 400 if artifact type is invalid', async () => {
      // Create a test run first
      const testData = {
        testId: 'test-123',
        testScenario: {
          id: 'test-123',
          name: 'Test Scenario',
          steps: []
        }
      };
      
      const createResponse = await request(app)
        .post('/runs')
        .send(testData);
      
      const runId = createResponse.body.runId;
      
      // Test endpoint with invalid artifact type
      const response = await request(app).get(`/runs/${runId}/artifacts/invalid`);
      
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid artifact type' });
    });
  });
  
  
  describe('Integration with Express middleware', () => {
    it('should work with custom middleware', async () => {
      // Create a new app with custom middleware
      const appWithMiddleware = express();
      appWithMiddleware.use(express.json());
      
      // Add a middleware that adds a custom property to the request
      appWithMiddleware.use((req, res, next) => {
        (req as any).customData = 'test-data';
        next();
      });
      
      // Add run routes
      appWithMiddleware.use('/runs', runRoutes(minioService, redisService, queueService));
      
      // Add a middleware that checks the custom property
      appWithMiddleware.use((req, res, next) => {
        if ((req as any).customData === 'test-data') {
          (req as any).middlewareWorked = true;
        }
        next();
      });
      
      // Add a test endpoint to verify middleware
      appWithMiddleware.get('/middleware-test', (req, res) => {
        res.status(200).json({ 
          middlewareWorked: (req as any).middlewareWorked,
          customData: (req as any).customData
        });
      });
      
      // No need to mock test results for the run routes
      
      // Test run routes endpoint
      const runsResponse = await request(appWithMiddleware).get('/runs');
      expect(runsResponse.status).toBe(200);
      
      // Test middleware endpoint
      const middlewareResponse = await request(appWithMiddleware).get('/middleware-test');
      expect(middlewareResponse.status).toBe(200);
      expect(middlewareResponse.body).toEqual({
        middlewareWorked: true,
        customData: 'test-data'
      });
    });
  });
});