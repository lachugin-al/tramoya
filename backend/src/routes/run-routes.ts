import express, {Router} from 'express';
import {v4 as uuidv4} from 'uuid';
import {createLogger} from '../utils/logger';
import {MinioService} from '../services/minio-service';
import {RedisService} from '../services/redis-service';
import {QueueService, QUEUE_NAMES, JobType, ExecuteTestJobData} from '../services/queue-service';
import {TestScenario} from '../models/test-scenario';
import {TestResult, TestStatus, createTestResult} from '../models/test-result';

const logger = createLogger('run-routes');

// In-memory storage for runs (would be replaced with a database in production)
const testRuns: Record<string, TestResult> = {};

/**
 * Creates and configures Express router for test run management
 *
 * This router provides endpoints for creating, retrieving, and managing test runs.
 * It allows clients to initiate test executions, check run status, and access run artifacts
 * such as videos and traces. Test runs are stored in memory but would typically be
 * persisted to a database in a production environment.
 *
 * @param {MinioService} minioService - Service for object storage operations
 * @param {RedisService} redisService - Service for Redis operations and pub/sub
 * @param {QueueService} queueService - Service for job queue management
 * @returns {Router} Express router configured with test run management endpoints
 */
export default function runRoutes(
    minioService: MinioService,
    redisService: RedisService,
    queueService: QueueService
): Router {
    const router = express.Router();

    /**
     * GET /runs
     * Retrieves all test runs
     *
     * @route GET /runs
     * @returns {TestResult[]} Array of all test runs
     */
    router.get('/', (req, res) => {
        const runs = Object.values(testRuns);
        logger.info(`Retrieved ${runs.length} test runs`);
        res.json(runs);
    });

    /**
     * GET /runs/:id
     * Retrieves a specific test run by ID
     *
     * @route GET /runs/:id
     * @param {string} req.params.id - The ID of the test run to retrieve
     * @returns {TestResult} The requested test run
     * @throws {404} If the test run is not found
     */
    router.get('/:id', (req, res) => {
        const {id} = req.params;
        const run = testRuns[id];

        if (!run) {
            logger.warn(`Test run not found: ${id}`);
            return res.status(404).json({error: 'Test run not found'});
        }

        logger.info(`Retrieved test run: ${id}`);
        res.json(run);
    });

    /**
     * POST /runs
     * Creates a new test run and queues it for execution
     *
     * @route POST /runs
     * @param {Object} req.body - The test run data
     * @param {string} req.body.testId - The ID of the test scenario to run
     * @param {TestScenario} req.body.testScenario - The test scenario object to execute
     * @returns {Object} Object containing message, runId, and initial result object
     * @returns {string} returns.message - Success message
     * @returns {string} returns.runId - The ID of the created test run
     * @returns {TestResult} returns.result - The initial test result object with RUNNING status
     * @throws {400} If required fields are missing or invalid
     * @throws {500} If there's an error creating the test run
     */
    router.post('/', async (req, res) => {
        const {testId, testScenario} = req.body;

        if (!testId || !testScenario) {
            return res.status(400).json({error: 'Test ID and test scenario are required'});
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
            res.status(500).json({error: 'Error creating test run'});
        }
    });

    /**
     * DELETE /runs/:id
     * Deletes a test run by ID
     *
     * @route DELETE /runs/:id
     * @param {string} req.params.id - The ID of the test run to delete
     * @returns {204} No content on successful deletion
     * @throws {404} If the test run is not found
     */
    router.delete('/:id', (req, res) => {
        const {id} = req.params;

        // Check if run exists
        if (!testRuns[id]) {
            logger.warn(`Test run not found for deletion: ${id}`);
            return res.status(404).json({error: 'Test run not found'});
        }

        // Delete the run
        delete testRuns[id];

        logger.info(`Deleted test run: ${id}`);
        res.status(204).send();
    });

    /**
     * GET /runs/:id/artifacts/:type
     * Generates a presigned URL for accessing a test run artifact
     *
     * This endpoint provides temporary access to test run artifacts stored in object storage,
     * such as video recordings of test executions or trace files for debugging. It validates
     * that the requested run exists and generates a time-limited URL for secure access to
     * the artifact without requiring direct access to the storage backend.
     *
     * @route GET /runs/:id/artifacts/:type
     * @param {string} req.params.id - The ID of the test run
     * @param {string} req.params.type - The type of artifact to access ('video' or 'trace')
     * @returns {Object} Object containing the presigned URL
     * @returns {string} returns.url - The presigned URL for accessing the artifact
     * @throws {404} If the test run is not found
     * @throws {400} If the artifact type is invalid
     * @throws {500} If there's an error generating the presigned URL
     */
    router.get('/:id/artifacts/:type', async (req, res) => {
        const {id, type} = req.params;

        // Check if run exists
        if (!testRuns[id]) {
            logger.warn(`Test run not found for artifact access: ${id}`);
            return res.status(404).json({error: 'Test run not found'});
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
                    return res.status(400).json({error: 'Invalid artifact type'});
            }

            // Generate presigned URL
            const url = await minioService.getPresignedUrl(objectName);

            logger.info(`Generated presigned URL for ${type} artifact of run: ${id}`);
            res.json({url});
        } catch (error) {
            logger.error(`Error generating presigned URL: ${error instanceof Error ? error.message : String(error)}`);
            res.status(500).json({error: 'Error generating presigned URL'});
        }
    });

    return router;
}