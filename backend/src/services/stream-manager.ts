import { Response } from 'express';
import { createLogger } from '../utils/logger';
import { TestResult, TestStatus, StepStatus, StepResult } from '../models/test-result';
import { RedisService } from './redis-service';

const logger = createLogger('stream-manager');

// Map to store SSE connections by run ID
const clients: Record<string, Response[]> = {};

/**
 * Add a client to the SSE connections map
 * @param runId The run ID
 * @param res The Express response object
 */
export function addClient(runId: string, res: Response): void {
  clients[runId] = clients[runId] ?? [];
  clients[runId].push(res);
  logger.debug(`Added client for run: ${runId}, total clients: ${clients[runId].length}`);
}

/**
 * Notify clients about an event
 * @param runId The run ID
 * @param data The data to send
 * @param end Whether to end the connection
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
 * Check if a run is complete and finalize it if needed
 * @param run The run object
 * @param redisService The Redis service to save the result
 * @returns True if the run was finalized, false otherwise
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