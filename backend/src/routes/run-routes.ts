import express, { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import { MinioService } from '../services/minio-service';
import { RedisService } from '../services/redis-service';
import { QueueService, QUEUE_NAMES, JobType, ExecuteTestJobData } from '../services/queue-service';
import { TestScenario } from '../models/test-scenario';
import { TestResult, TestStatus, createTestResult } from '../models/test-result';

const logger = createLogger('run-routes');

// In-memory storage for runs (would be replaced with a database in production)
const testRuns: Record<string, TestResult> = {};

/**
 * Create run routes
 */
export default function runRoutes(
  minioService: MinioService,
  redisService: RedisService,
  queueService: QueueService
): Router {
  const router = express.Router();
  
  /**
   * GET /runs
   * Get all test runs
   */
  router.get('/', (req, res) => {
    const runs = Object.values(testRuns);
    logger.info(`Retrieved ${runs.length} test runs`);
    res.json(runs);
  });
  
  /**
   * GET /runs/:id
   * Get a specific test run by ID
   */
  router.get('/:id', (req, res) => {
    const { id } = req.params;
    const run = testRuns[id];
    
    if (!run) {
      logger.warn(`Test run not found: ${id}`);
      return res.status(404).json({ error: 'Test run not found' });
    }
    
    logger.info(`Retrieved test run: ${id}`);
    res.json(run);
  });
  
  /**
   * POST /runs
   * Create a new test run
   */
  router.post('/', async (req, res) => {
    const { testId, testScenario } = req.body;
    
    if (!testId || !testScenario) {
      return res.status(400).json({ error: 'Test ID and test scenario are required' });
    }
    
    try {
      // Generate a unique run ID
      const runId = `run_${uuidv4()}`;
      
      // Create initial test result
      const testResult = createTestResult(testScenario);
      testResult.id = runId;
      testResult.status = TestStatus.RUNNING;
      
      // Store the result
      testRuns[runId] = testResult;
      
      // Add job to queue
      const jobData: ExecuteTestJobData = {
        testId,
        runId,
        testScenario
      };
      
      await queueService.addJob(
        QUEUE_NAMES.TEST_EXECUTION,
        JobType.EXECUTE_TEST,
        jobData
      );
      
      logger.info(`Created new test run: ${runId} for test: ${testId}`);
      
      // Return the run information
      res.status(201).json({
        message: 'Test run created',
        runId,
        result: testResult
      });
    } catch (error) {
      logger.error(`Error creating test run: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Error creating test run' });
    }
  });
  
  /**
   * DELETE /runs/:id
   * Delete a test run
   */
  router.delete('/:id', (req, res) => {
    const { id } = req.params;
    
    // Check if run exists
    if (!testRuns[id]) {
      logger.warn(`Test run not found for deletion: ${id}`);
      return res.status(404).json({ error: 'Test run not found' });
    }
    
    // Delete the run
    delete testRuns[id];
    
    logger.info(`Deleted test run: ${id}`);
    res.status(204).send();
  });
  
  /**
   * GET /runs/:id/artifacts/:type
   * Get a presigned URL for a run artifact
   */
  router.get('/:id/artifacts/:type', async (req, res) => {
    const { id, type } = req.params;
    
    // Check if run exists
    if (!testRuns[id]) {
      logger.warn(`Test run not found for artifact access: ${id}`);
      return res.status(404).json({ error: 'Test run not found' });
    }
    
    try {
      let objectName: string;
      
      // Determine object name based on artifact type
      switch (type) {
        case 'video':
          objectName = `runs/${id}/video.webm`;
          break;
        case 'trace':
          objectName = `runs/${id}/trace.zip`;
          break;
        default:
          return res.status(400).json({ error: 'Invalid artifact type' });
      }
      
      // Generate presigned URL
      const url = await minioService.getPresignedUrl(objectName);
      
      logger.info(`Generated presigned URL for ${type} artifact of run: ${id}`);
      res.json({ url });
    } catch (error) {
      logger.error(`Error generating presigned URL: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Error generating presigned URL' });
    }
  });
  
  return router;
}