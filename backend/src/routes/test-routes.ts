import express, { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import { TestScenario, TestStep, createTestScenario } from '../models/test-scenario';
import { TestResult, createTestResult, TestStatus } from '../models/test-result';
import { MinioService } from '../services/minio-service';
import { RedisService } from '../services/redis-service';
import { QueueService, QUEUE_NAMES, JobType, ExecuteTestJobData } from '../services/queue-service';

const logger = createLogger('test-routes');

// In-memory storage for tests and results (would be replaced with a database in production)
const testScenarios: Record<string, TestScenario> = {};
const testResults: Record<string, TestResult> = {};

/**
 * Creates and configures Express router for test scenario management
 * 
 * This router provides endpoints for creating, retrieving, updating, and deleting test scenarios,
 * as well as executing tests and managing test results. It subscribes to Redis events to update
 * test results in real-time.
 * 
 * @param {MinioService} minioService - Service for object storage operations
 * @param {RedisService} redisService - Service for Redis operations and pub/sub
 * @param {QueueService} queueService - Service for job queue management
 * @returns {Router} Express router configured with test management endpoints
 */
export default function testRoutes(
  minioService: MinioService,
  redisService: RedisService,
  queueService: QueueService
): Router {
  const router = express.Router();
  
  /**
   * Subscribes to Redis test events to update test results in real-time
   * 
   * This subscription listens for test execution events published to Redis and updates
   * the corresponding test results in memory. It handles two main event types:
   * - RUN_FINISHED: Updates the overall test result status, end time, and artifact URLs
   * - STEP: Updates individual step statuses and adds screenshots to step results
   * 
   * The subscription is set up when the router is created and remains active for the
   * lifetime of the server. Errors during subscription or event processing are logged
   * but don't crash the application.
   * 
   * @private
   */
  try {
    redisService.subscribe('test-events', (message: string) => {
      /**
       * Processes incoming Redis test events
       * 
       * @private
       * @param {string} message - JSON string containing the event data
       */
      try {
        const event = JSON.parse(message);
        if (event.type === 'RUN_FINISHED' && event.runId && testResults[event.runId]) {
          // Update test result status and end time
          testResults[event.runId].status = event.status;
          testResults[event.runId].endTime = new Date();
          testResults[event.runId].videoUrl = event.video;
          testResults[event.runId].traceUrl = event.trace;
          logger.info(`Updated test result status for ${event.runId}: ${event.status}`);
        } else if (event.type === 'STEP' && event.runId && event.stepId && testResults[event.runId]) {
          // Find and update the step result
          const stepResult = testResults[event.runId].stepResults.find(s => s.stepId === event.stepId);
          if (stepResult) {
            stepResult.status = event.status;
            if (event.url) {
              stepResult.screenshots.push({
                id: `screenshot_${Date.now()}`,
                stepId: event.stepId,
                timestamp: new Date(),
                path: event.url || '',
                url: event.url
              });
            }
            logger.debug(`Updated step result status for ${event.runId}/${event.stepId}: ${event.status}`);
          }
        }
      } catch (error) {
        logger.error(`Error processing test event: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  } catch (error) {
    // Log the error but don't let it crash the router
    logger.error(`Error subscribing to test events: ${error instanceof Error ? error.message : String(error)}`);
    logger.warn('Test event subscription failed, real-time updates will not be available');
  }

  /**
   * GET /tests
   * Retrieves all test scenarios
   * 
   * @route GET /tests
   * @returns {TestScenario[]} Array of all test scenarios
   * @throws {500} If there's an error retrieving test scenarios
   */
  router.get('/', (req, res) => {
    try {
      const tests = Object.values(testScenarios);
      logger.info(`Retrieved ${tests.length} test scenarios`);
      res.json(tests);
    } catch (error) {
      logger.error(`Error retrieving test scenarios: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Error retrieving test scenarios' });
    }
  });
  
  /**
   * GET /tests/results
   * Retrieves all test results
   * 
   * @route GET /tests/results
   * @returns {TestResult[]} Array of all test results
   * @throws {500} If there's an error retrieving test results
   */
  router.get('/results', (req, res) => {
    try {
      const results = Object.values(testResults);
      logger.info(`Retrieved ${results.length} test results`);
      res.json(results);
    } catch (error) {
      logger.error(`Error retrieving test results: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Error retrieving test results' });
    }
  });
  
  /**
   * GET /tests/results/:id
   * Retrieves a specific test result by ID
   * 
   * @route GET /tests/results/:id
   * @param {string} req.params.id - The ID of the test result to retrieve
   * @returns {TestResult} The requested test result
   * @throws {404} If the test result is not found
   * @throws {500} If there's an error retrieving the test result
   */
  router.get('/results/:id', (req, res) => {
    try {
      const { id } = req.params;
      const result = testResults[id];
      
      if (!result) {
        logger.warn(`Test result not found: ${id}`);
        return res.status(404).json({ error: 'Test result not found' });
      }
      
      logger.info(`Retrieved test result: ${id}`);
      res.json(result);
    } catch (error) {
      logger.error(`Error retrieving test result: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Error retrieving test result' });
    }
  });

  /**
   * GET /tests/:id
   * Retrieves a specific test scenario by ID
   * 
   * @route GET /tests/:id
   * @param {string} req.params.id - The ID of the test scenario to retrieve
   * @returns {TestScenario} The requested test scenario
   * @throws {404} If the test scenario is not found
   * @throws {500} If there's an error retrieving the test scenario
   */
  router.get('/:id', (req, res) => {
    try {
      const { id } = req.params;
      const test = testScenarios[id];
      
      if (!test) {
        logger.warn(`Test scenario not found: ${id}`);
        return res.status(404).json({ error: 'Test scenario not found' });
      }
      
      logger.info(`Retrieved test scenario: ${id}`);
      res.json(test);
    } catch (error) {
      logger.error(`Error retrieving test scenario: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Error retrieving test scenario' });
    }
  });

  /**
   * POST /tests
   * Creates a new test scenario
   * 
   * @route POST /tests
   * @param {Object} req.body - The test scenario data
   * @param {string} req.body.name - The name of the test scenario (required)
   * @param {string} [req.body.description] - The description of the test scenario
   * @param {TestStep[]} [req.body.steps] - Array of test steps
   * @returns {TestScenario} The created test scenario
   * @throws {400} If required fields are missing or invalid
   * @throws {500} If there's an error creating the test scenario
   */
  router.post('/', (req, res) => {
    try {
      const { name, description, steps } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Test name is required' });
      }
      
      // Validate steps if provided
      if (steps && !Array.isArray(steps)) {
        return res.status(400).json({ error: 'Steps must be an array' });
      }
      
      // Add unique IDs to steps if they don't have them
      const stepsWithIds = steps?.map((step: TestStep) => ({
        ...step,
        id: step.id || uuidv4()
      })) || [];
      
      // Create the test scenario
      const testScenario = createTestScenario(name, description, stepsWithIds);
      
      // Store it
      testScenarios[testScenario.id] = testScenario;
      
      logger.info(`Created new test scenario: ${testScenario.id}`);
      res.status(201).json(testScenario);
    } catch (error) {
      logger.error(`Error creating test scenario: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Error creating test scenario' });
    }
  });

  /**
   * PUT /tests/:id
   * Updates an existing test scenario
   * 
   * @route PUT /tests/:id
   * @param {string} req.params.id - The ID of the test scenario to update
   * @param {Object} req.body - The updated test scenario data
   * @param {string} req.body.name - The name of the test scenario (required)
   * @param {string} [req.body.description] - The description of the test scenario
   * @param {TestStep[]} [req.body.steps] - Array of test steps
   * @returns {TestScenario} The updated test scenario
   * @throws {404} If the test scenario is not found
   * @throws {400} If required fields are missing or invalid
   * @throws {500} If there's an error updating the test scenario
   */
  router.put('/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, steps } = req.body;
      
      // Check if test exists
      if (!testScenarios[id]) {
        logger.warn(`Test scenario not found for update: ${id}`);
        return res.status(404).json({ error: 'Test scenario not found' });
      }
      
      // Validate required fields
      if (!name) {
        return res.status(400).json({ error: 'Test name is required' });
      }
      
      // Validate steps if provided
      if (steps && !Array.isArray(steps)) {
        return res.status(400).json({ error: 'Steps must be an array' });
      }
      
      // Add unique IDs to steps if they don't have them
      const stepsWithIds = steps?.map((step: TestStep) => ({
        ...step,
        id: step.id || uuidv4()
      })) || [];
      
      // Update the test scenario
      const updatedTest: TestScenario = {
        ...testScenarios[id],
        name,
        description,
        steps: stepsWithIds,
        updatedAt: new Date()
      };
      
      // Store it
      testScenarios[id] = updatedTest;
      
      logger.info(`Updated test scenario: ${id}`);
      res.json(updatedTest);
    } catch (error) {
      logger.error(`Error updating test scenario: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Error updating test scenario' });
    }
  });

  /**
   * DELETE /tests/:id
   * Deletes a test scenario by ID
   * 
   * @route DELETE /tests/:id
   * @param {string} req.params.id - The ID of the test scenario to delete
   * @returns {204} No content on successful deletion
   * @throws {404} If the test scenario is not found
   * @throws {500} If there's an error deleting the test scenario
   */
  router.delete('/:id', (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if test exists
      if (!testScenarios[id]) {
        logger.warn(`Test scenario not found for deletion: ${id}`);
        return res.status(404).json({ error: 'Test scenario not found' });
      }
      
      // Delete the test scenario
      delete testScenarios[id];
      
      logger.info(`Deleted test scenario: ${id}`);
      res.status(204).send();
    } catch (error) {
      logger.error(`Error deleting test scenario: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Error deleting test scenario' });
    }
  });

  /**
   * POST /tests/:id/execute
   * Executes a test scenario by ID
   * 
   * @route POST /tests/:id/execute
   * @param {string} req.params.id - The ID of the test scenario to execute
   * @returns {Object} Object containing message, resultId, and initial result object
   * @returns {string} returns.message - Success message
   * @returns {string} returns.resultId - The ID of the created test result
   * @returns {TestResult} returns.result - The initial test result object with RUNNING status
   * @throws {404} If the test scenario is not found
   * @throws {500} If there's an error executing the test
   */
  router.post('/:id/execute', async (req, res) => {
    const { id } = req.params;
    
    // Check if test exists
    if (!testScenarios[id]) {
      logger.warn(`Test scenario not found for execution: ${id}`);
      return res.status(404).json({ error: 'Test scenario not found' });
    }
    
    try {
      const testScenario = testScenarios[id];
      
      // Generate a unique run ID
      const runId = `run_${uuidv4()}`;
      
      // Create a new test result
      const testResult = createTestResult(testScenario);
      testResult.id = runId;
      testResult.status = TestStatus.RUNNING;
      
      // Store the result
      testResults[testResult.id] = testResult;
      
      // Add job to queue
      const jobData: ExecuteTestJobData = {
        testId: id,
        runId,
        testScenario
      };
      
      await queueService.addJob(
        QUEUE_NAMES.TEST_EXECUTION,
        JobType.EXECUTE_TEST,
        jobData
      );
      
      // Return the initial result with running status
      res.status(202).json({
        message: 'Test execution started',
        resultId: testResult.id,
        result: testResult
      });
      
      logger.info(`Test execution queued: ${id}, run ID: ${runId}`);
    } catch (error) {
      logger.error(`Error executing test: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Error executing test' });
    }
  });

  /**
   * GET /tests/results
   * Retrieves all test results
   * 
   * @route GET /tests/results
   * @returns {TestResult[]} Array of all test results
   * @throws {500} If there's an error retrieving test results
   * @deprecated This is a duplicate route handler. Consider removing it in future updates.
   */
  router.get('/results', (req, res) => {
    try {
      const results = Object.values(testResults);
      logger.info(`Retrieved ${results.length} test results`);
      res.json(results);
    } catch (error) {
      logger.error(`Error retrieving test results: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Error retrieving test results' });
    }
  });

  /**
   * GET /tests/results/:id
   * Retrieves a specific test result by ID
   * 
   * @route GET /tests/results/:id
   * @param {string} req.params.id - The ID of the test result to retrieve
   * @returns {TestResult} The requested test result
   * @throws {404} If the test result is not found
   * @throws {500} If there's an error retrieving the test result
   * @deprecated This is a duplicate route handler. Consider removing it in future updates.
   */
  router.get('/results/:id', (req, res) => {
    try {
      const { id } = req.params;
      const result = testResults[id];
      
      if (!result) {
        logger.warn(`Test result not found: ${id}`);
        return res.status(404).json({ error: 'Test result not found' });
      }
      
      logger.info(`Retrieved test result: ${id}`);
      res.json(result);
    } catch (error) {
      logger.error(`Error retrieving test result: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Error retrieving test result' });
    }
  });

  /**
   * DELETE /tests/results/:id
   * Deletes a test result by ID
   * 
   * @route DELETE /tests/results/:id
   * @param {string} req.params.id - The ID of the test result to delete
   * @returns {204} No content on successful deletion
   * @throws {404} If the test result is not found
   * @throws {500} If there's an error deleting the test result
   */
  router.delete('/results/:id', (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if result exists
      if (!testResults[id]) {
        logger.warn(`Test result not found for deletion: ${id}`);
        return res.status(404).json({ error: 'Test result not found' });
      }
      
      // Delete the test result
      delete testResults[id];
      
      logger.info(`Deleted test result: ${id}`);
      res.status(204).send();
    } catch (error) {
      logger.error(`Error deleting test result: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Error deleting test result' });
    }
  });

  return router;
}