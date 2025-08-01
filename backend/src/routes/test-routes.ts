import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';
import { TestScenario, TestStep, createTestScenario } from '../models/test-scenario';
import { TestResult, createTestResult, TestStatus } from '../models/test-result';
import { TestRunner } from '../services/test-runner';
import { MinioService } from '../services/minio-service';

const router = express.Router();
const logger = createLogger('test-routes');

// Initialize services
const minioService = new MinioService();
const testRunner = new TestRunner(minioService);

// In-memory storage for tests and results (would be replaced with a database in production)
const testScenarios: Record<string, TestScenario> = {};
const testResults: Record<string, TestResult> = {};

/**
 * GET /tests
 * Get all test scenarios
 */
router.get('/', (req, res) => {
  const tests = Object.values(testScenarios);
  logger.info(`Retrieved ${tests.length} test scenarios`);
  res.json(tests);
});

/**
 * GET /tests/:id
 * Get a specific test scenario by ID
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const test = testScenarios[id];
  
  if (!test) {
    logger.warn(`Test scenario not found: ${id}`);
    return res.status(404).json({ error: 'Test scenario not found' });
  }
  
  logger.info(`Retrieved test scenario: ${id}`);
  res.json(test);
});

/**
 * POST /tests
 * Create a new test scenario
 */
router.post('/', (req, res) => {
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
});

/**
 * PUT /tests/:id
 * Update an existing test scenario
 */
router.put('/:id', (req, res) => {
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
});

/**
 * DELETE /tests/:id
 * Delete a test scenario
 */
router.delete('/:id', (req, res) => {
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
});

/**
 * POST /tests/:id/execute
 * Execute a test scenario
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
    
    // Create a new test result
    const testResult = createTestResult(testScenario);
    
    // Set the status to RUNNING before returning to client
    testResult.status = TestStatus.RUNNING;
    
    // Store the result
    testResults[testResult.id] = testResult;
    
    // Return the initial result with running status
    res.status(202).json({
      message: 'Test execution started',
      resultId: testResult.id,
      result: testResult
    });
    
    // Execute the test asynchronously
    logger.info(`Starting test execution: ${id}`);
    
    // Execute the test
    const updatedResult = await testRunner.executeTest(testScenario);
    
    // Update the stored result
    testResults[testResult.id] = updatedResult;
    
    logger.info(`Test execution completed: ${id}, status: ${updatedResult.status}`);
  } catch (error) {
    logger.error(`Error executing test: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: 'Error executing test' });
  }
});

/**
 * GET /tests/results
 * Get all test results
 */
router.get('/results', (req, res) => {
  const results = Object.values(testResults);
  logger.info(`Retrieved ${results.length} test results`);
  res.json(results);
});

/**
 * GET /tests/results/:id
 * Get a specific test result by ID
 */
router.get('/results/:id', (req, res) => {
  const { id } = req.params;
  const result = testResults[id];
  
  if (!result) {
    logger.warn(`Test result not found: ${id}`);
    return res.status(404).json({ error: 'Test result not found' });
  }
  
  logger.info(`Retrieved test result: ${id}`);
  res.json(result);
});

/**
 * GET /tests/:id/results
 * Get all results for a specific test
 */
router.get('/:id/results', (req, res) => {
  const { id } = req.params;
  
  // Check if test exists
  if (!testScenarios[id]) {
    logger.warn(`Test scenario not found for results: ${id}`);
    return res.status(404).json({ error: 'Test scenario not found' });
  }
  
  // Find all results for this test
  const results = Object.values(testResults).filter(result => result.testId === id);
  
  logger.info(`Retrieved ${results.length} results for test: ${id}`);
  res.json(results);
});

/**
 * DELETE /tests/results/:id
 * Delete a test result
 */
router.delete('/results/:id', (req, res) => {
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
});

// Clean up resources when the server shuts down
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing browser');
  await testRunner.closeBrowser();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing browser');
  await testRunner.closeBrowser();
});

export default router;