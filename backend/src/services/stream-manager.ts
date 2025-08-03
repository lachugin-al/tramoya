import {Response} from 'express';
import {createLogger} from '../utils/logger';
import {TestResult, TestStatus, StepStatus, StepResult} from '../models/test-result';
import {RedisService} from './redis-service';

const logger = createLogger('stream-manager');

/**
 * Map to store Server-Sent Events (SSE) connections by run ID
 *
 * @type {Object.<string, Response[]>}
 * @description This map stores active SSE connections organized by test run ID.
 * Each run ID maps to an array of Express Response objects representing client connections.
 * This allows the system to send real-time updates to all clients interested in a specific test run.
 * @private
 */
const clients: Record<string, Response[]> = {};

/**
 * Registers a new client connection for a specific test run
 *
 * @function addClient
 * @description Adds a client's Express Response object to the connections map for a specific run ID.
 * If this is the first client for the run ID, it initializes a new array.
 * This function is called when a client establishes an SSE connection to receive real-time updates
 * about a test run.
 *
 * @param {string} runId - The unique identifier of the test run to subscribe to
 * @param {Response} res - The Express response object representing the client connection
 * @returns {void}
 * @public
 */
export function addClient(runId: string, res: Response): void {
    clients[runId] = clients[runId] ?? [];
    clients[runId].push(res);
    logger.debug(`Added client for run: ${runId}, total clients: ${clients[runId].length}`);
}

/**
 * Sends data to all clients subscribed to a specific test run
 *
 * @function notifyClients
 * @description Broadcasts data to all clients that have subscribed to updates for a specific run ID.
 * The data is sent as a JSON string in the Server-Sent Events (SSE) format.
 *
 * If the 'end' parameter is true, the function will:
 * 1. Close all client connections for this run ID
 * 2. Remove the run ID from the clients map to free up resources
 *
 * If no clients are subscribed to the specified run ID, the function does nothing.
 *
 * @param {string} runId - The unique identifier of the test run to send updates for
 * @param {unknown} data - The data to send to clients (will be JSON stringified)
 * @param {boolean} [end=false] - Whether to end the connection after sending the data
 * @returns {void}
 * @public
 */
export function notifyClients(runId: string, data: unknown, end = false): void {
    const receivers = clients[runId] ?? [];

    if (receivers.length === 0) {
        logger.debug(`No clients to notify for run: ${runId}`);
        return;
    }

    logger.debug(`Notifying ${receivers.length} clients for run: ${runId}, end: ${end}`);

    receivers.forEach(res => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        if (end) {
            res.end();
        }
    });

    if (end) {
        delete clients[runId];
        logger.info(`Closed all connections for run: ${runId}`);
    }
}

/**
 * Checks if a test run is complete and updates its status accordingly
 *
 * @function finalizeRunIfNeeded
 * @description Examines a test run to determine if all steps have completed and updates
 * the run's status based on the results of its steps. The function will:
 *
 * 1. Check if the run is already in a final state (not RUNNING) and do nothing if it is
 * 2. Verify if all steps are completed (not in RUNNING or PENDING state)
 * 3. Determine the final status based on step results:
 *    - PASSED: if all steps passed
 *    - FAILED: if any step failed
 *    - ERROR: if any step had an error
 * 4. Save the updated test result to Redis if the status changed
 *
 * Note: This function does not notify clients about the status change.
 * The test-runner.ts is responsible for sending the final events to avoid duplicates.
 *
 * @param {TestResult} run - The test run object to check and potentially finalize
 * @param {RedisService} redisService - The Redis service instance used to save the updated result
 * @returns {Promise<boolean>} A promise that resolves to true if the run was finalized, false otherwise
 * @public
 */
export async function finalizeRunIfNeeded(run: TestResult, redisService: RedisService): Promise<boolean> {
    // If already in a final state, do nothing
    if (run.status !== TestStatus.RUNNING) {
        logger.debug(`Run ${run.id} already finalized with status: ${run.status}`);
        return false;
    }

    const stepStatuses = run.stepResults.map((s: StepResult) => s.status);

    // Check if all steps are completed (not RUNNING or PENDING)
    const allStepsCompleted = stepStatuses.every(
        (s: StepStatus) => s !== StepStatus.RUNNING && s !== StepStatus.PENDING
    );

    if (!allStepsCompleted) {
        logger.debug(`Run ${run.id} still has pending or running steps`);
        return false;
    }

    // Determine final status based on step results
    if (stepStatuses.every((s: StepStatus) => s === StepStatus.PASSED)) {
        run.status = TestStatus.PASSED;
    } else if (stepStatuses.some((s: StepStatus) => s === StepStatus.FAILED)) {
        run.status = TestStatus.FAILED;
    } else if (stepStatuses.some((s: StepStatus) => s === StepStatus.ERROR)) {
        run.status = TestStatus.ERROR;
    } else {
        // This shouldn't happen if all steps are completed
        logger.warn(`Run ${run.id} has all steps completed but couldn't determine final status`);
        return false;
    }

    logger.info(`Finalizing run ${run.id} with status: ${run.status}`);

    // Save the updated run
    await redisService.saveTestResult(run);

    // Note: We don't publish a run-finished event here anymore
    // This is now handled exclusively by test-runner.ts to avoid duplicate events
    // and to ensure that video and trace URLs are included in the event

    // Use runId if available, fallback to id for consistency with test-runner.ts
    const runId = run.runId ?? run.id;

    // We no longer notify clients about the final state here to avoid duplicate events
    // The test-runner.ts will handle this and send the [DONE] message
    logger.info(`Run ${runId} finalized with status: ${run.status}, waiting for test-runner to send events`);

    return true;
}