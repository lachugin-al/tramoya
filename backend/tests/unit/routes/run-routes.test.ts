import express, { Express } from 'express';
import request from 'supertest';
import runRoutes from '../../../src/routes/run-routes';
import { MinioService } from '../../../src/services/minio-service';
import { RedisService } from '../../../src/services/redis-service';
import { QueueService, QUEUE_NAMES, JobType } from '../../../src/services/queue-service';
import { TestStatus } from '../../../src/models/test-result';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('../../../src/utils/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid')
}));

describe('Run Routes', () => {
  let app: Express;
  let mockMinioService: jest.Mocked<MinioService>;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockQueueService: jest.Mocked<QueueService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock services
    mockMinioService = {
      getObject: jest.fn(),
      putObject: jest.fn(),
      listObjects: jest.fn(),
      deleteObject: jest.fn()
    } as unknown as jest.Mocked<MinioService>;

    mockRedisService = {
      getTestResult: jest.fn(),
      saveTestResult: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      getClient: jest.fn(),
      getPublisher: jest.fn(),
      getSubscriber: jest.fn(),
      close: jest.fn()
    } as unknown as jest.Mocked<RedisService>;

    mockQueueService = {
      addJob: jest.fn().mockResolvedValue({ id: 'job-123' })
    } as unknown as jest.Mocked<QueueService>;

    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/runs', runRoutes(mockMinioService, mockRedisService, mockQueueService));
  });

  describe('GET /runs', () => {
    it('should return all test runs', async () => {
      // Create test runs using the POST endpoint
      const testData1 = {
        testId: 'test-1',
        testScenario: {
          id: 'test-1',
          name: 'Test Scenario 1',
          steps: []
        }
      };
      
      const testData2 = {
        testId: 'test-2',
        testScenario: {
          id: 'test-2',
          name: 'Test Scenario 2',
          steps: []
        }
      };
      
      // Create first test run
      const createResponse1 = await request(app)
        .post('/runs')
        .send(testData1);
        
      // Create second test run
      const createResponse2 = await request(app)
        .post('/runs')
        .send(testData2);
      
      // Get the run IDs from the responses
      const runId1 = createResponse1.body.runId;
      const runId2 = createResponse2.body.runId;
      
      // Test GET endpoint
      const response = await request(app).get('/runs');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Verify the response contains at least the test runs we created
      const runIds = response.body.map((run: any) => run.id);
      expect(runIds).toContain(runId1);
      expect(runIds).toContain(runId2);
    });
  });

  describe('GET /runs/:id', () => {
    it('should return a specific test run', async () => {
      // Create a test run using the POST endpoint
      const testData = {
        testId: 'test-1',
        testScenario: {
          id: 'test-1',
          name: 'Test Scenario',
          steps: []
        }
      };
      
      // Create the test run
      const createResponse = await request(app)
        .post('/runs')
        .send(testData);
      
      // Get the run ID from the response
      const runId = createResponse.body.runId;
      
      // Test GET endpoint with the run ID
      const response = await request(app).get(`/runs/${runId}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: runId,
        testId: 'test-1',
        status: TestStatus.RUNNING
      });
    });

    it('should return 404 if test run is not found', async () => {
      // Test endpoint with a non-existent run ID
      const response = await request(app).get('/runs/nonexistent');
      
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Test run not found' });
    });
  });

  describe('DELETE /runs/:id', () => {
    it('should delete a test run', async () => {
      // Create a test run using the POST endpoint
      const testData = {
        testId: 'test-1',
        testScenario: {
          id: 'test-1',
          name: 'Test Scenario',
          steps: []
        }
      };
      
      // Create the test run
      const createResponse = await request(app)
        .post('/runs')
        .send(testData);
      
      // Get the run ID from the response
      const runId = createResponse.body.runId;
      
      // Test DELETE endpoint with the run ID
      const response = await request(app).delete(`/runs/${runId}`);
      
      expect(response.status).toBe(204);
      
      // Verify the run was deleted by trying to get it
      const getResponse = await request(app).get(`/runs/${runId}`);
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 if test run to delete is not found', async () => {
      // Test endpoint with a non-existent run ID
      const response = await request(app).delete('/runs/nonexistent');
      
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Test run not found' });
    });
  });
});