import { TestScenario } from './test-scenario';

/**
 * Enum representing the possible statuses of a test execution.
 * These statuses track the lifecycle of a test from creation to completion.
 * 
 * @enum {string}
 * @readonly
 * @property {string} PENDING - Test has been created but execution has not started
 * @property {string} RUNNING - Test is currently being executed
 * @property {string} PASSED - Test has completed successfully with all assertions passing
 * @property {string} FAILED - Test has completed but one or more assertions failed
 * @property {string} ERROR - Test execution encountered an error and could not complete normally
 */
export enum TestStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PASSED = 'passed',
  FAILED = 'failed',
  ERROR = 'error'
}

/**
 * Enum representing the possible statuses of a test step execution.
 * These statuses track the lifecycle of an individual step within a test.
 * 
 * @enum {string}
 * @readonly
 * @property {string} PENDING - Step has been created but execution has not started
 * @property {string} RUNNING - Step is currently being executed
 * @property {string} PASSED - Step has completed successfully with all assertions passing
 * @property {string} FAILED - Step has completed but one or more assertions failed
 * @property {string} SKIPPED - Step was not executed (usually because a previous step failed)
 * @property {string} ERROR - Step execution encountered an error and could not complete normally
 */
export enum StepStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  ERROR = 'error'
}

/**
 * Interface representing a log entry generated during test step execution.
 * Log entries provide detailed information about what happened during test execution,
 * which is useful for debugging and understanding test results.
 * 
 * @interface LogEntry
 * @property {Date} timestamp - The date and time when the log entry was created
 * @property {'info' | 'warn' | 'error' | 'debug'} level - The severity level of the log entry
 *   - 'info': Informational messages about normal test execution
 *   - 'warn': Warning messages that don't cause test failure but might indicate issues
 *   - 'error': Error messages that typically cause test failure
 *   - 'debug': Detailed messages for debugging purposes
 * @property {string} message - The content of the log message
 */
export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

/**
 * Interface representing a screenshot captured during test execution.
 * Screenshots provide visual evidence of the application state at specific points
 * during test execution, which is useful for debugging and verification.
 * 
 * @interface Screenshot
 * @property {string} id - Unique identifier for the screenshot
 * @property {string} stepId - ID of the test step during which the screenshot was taken
 * @property {Date} timestamp - The date and time when the screenshot was captured
 * @property {string} path - File system path where the screenshot is stored
 * @property {string} [url] - Optional presigned URL for frontend access to the screenshot
 *                           (typically generated when the screenshot needs to be displayed in the UI)
 */
export interface Screenshot {
  id: string;
  stepId: string;
  timestamp: Date;
  path: string;
  url?: string; // Presigned URL for frontend access
}

/**
 * Interface representing the result of executing a single test step.
 * StepResult contains all information about what happened during the execution of a step,
 * including its status, timing information, logs, screenshots, and any errors that occurred.
 * 
 * @interface StepResult
 * @property {string} stepId - ID of the test step this result corresponds to
 * @property {StepStatus} status - Current status of the step execution (pending, running, passed, etc.)
 * @property {Date} [startTime] - Optional timestamp when the step execution started
 * @property {Date} [endTime] - Optional timestamp when the step execution completed
 * @property {LogEntry[]} logs - Array of log entries generated during step execution
 * @property {Screenshot[]} screenshots - Array of screenshots captured during step execution
 * @property {Object} [error] - Optional error information if the step failed or encountered an error
 * @property {string} error.message - Error message describing what went wrong
 * @property {string} [error.stack] - Optional stack trace for the error
 */
export interface StepResult {
  stepId: string;
  status: StepStatus;
  startTime?: Date;
  endTime?: Date;
  logs: LogEntry[];
  screenshots: Screenshot[];
  error?: {
    message: string;
    stack?: string;
  };
}

/**
 * Interface representing the complete result of executing a test scenario.
 * TestResult contains all information about the test execution, including overall status,
 * timing information, results of individual steps, and summary statistics.
 * 
 * @interface TestResult
 * @property {string} id - Unique identifier for the test result
 * @property {string} [runId] - Optional identifier for the test run (useful when multiple tests are executed as a batch)
 * @property {string} testId - ID of the test scenario this result corresponds to
 * @property {TestStatus} status - Current status of the test execution (pending, running, passed, etc.)
 * @property {Date} startTime - Timestamp when the test execution started
 * @property {Date} [endTime] - Optional timestamp when the test execution completed
 * @property {StepResult[]} stepResults - Array of results for each step in the test
 * @property {string} [videoUrl] - Optional URL to a video recording of the test execution
 * @property {string} [traceUrl] - Optional URL to a trace file containing detailed execution data
 * @property {Object} [summary] - Optional summary statistics for the test execution
 * @property {number} summary.totalSteps - Total number of steps in the test
 * @property {number} summary.passedSteps - Number of steps that passed
 * @property {number} summary.failedSteps - Number of steps that failed
 * @property {number} summary.skippedSteps - Number of steps that were skipped
 * @property {number} summary.errorSteps - Number of steps that encountered errors
 * @property {number} summary.duration - Total duration of the test execution in milliseconds
 */
export interface TestResult {
  id: string;
  runId?: string; // Optional runId for tracking test execution
  testId: string;
  status: TestStatus;
  startTime: Date;
  endTime?: Date;
  stepResults: StepResult[];
  videoUrl?: string; // URL to video recording
  traceUrl?: string; // URL to trace file
  summary?: {
    totalSteps: number;
    passedSteps: number;
    failedSteps: number;
    skippedSteps: number;
    errorSteps: number;
    duration: number; // in milliseconds
  };
}

/**
 * Creates a new test result for a given test scenario.
 * This function initializes a TestResult object with default values and pending status.
 * It automatically creates step results for each step in the test scenario.
 * 
 * @function createTestResult
 * @param {TestScenario} testScenario - The test scenario for which to create a result
 * @returns {TestResult} A new TestResult object with initialized properties
 * 
 * @example
 * // Create a test result for a scenario
 * const scenario = getTestScenario('test-123');
 * const result = createTestResult(scenario);
 * // result.status will be PENDING
 * // result.stepResults will contain an entry for each step in the scenario
 */
export const createTestResult = (testScenario: TestScenario): TestResult => {
  const now = new Date();
  
  // Create initial step results with pending status
  const stepResults: StepResult[] = testScenario.steps.map(step => ({
    stepId: step.id,
    status: StepStatus.PENDING,
    logs: [],
    screenshots: []
  }));
  
  return {
    id: `result_${now.getTime()}`,
    testId: testScenario.id,
    status: TestStatus.PENDING,
    startTime: now,
    stepResults
  };
};

/**
 * Updates the summary statistics of a test result based on its step results.
 * This function calculates metrics such as the number of passed, failed, skipped, and error steps,
 * as well as the total duration of the test if it has completed.
 * 
 * @function updateTestResultSummary
 * @param {TestResult} testResult - The test result to update
 * @returns {TestResult} A new TestResult object with updated summary statistics
 * 
 * @example
 * // Update the summary of a completed test result
 * const updatedResult = updateTestResultSummary(testResult);
 * console.log(`Test passed ${updatedResult.summary.passedSteps} out of ${updatedResult.summary.totalSteps} steps`);
 * console.log(`Test duration: ${updatedResult.summary.duration}ms`);
 * 
 * @remarks
 * This function does not modify the original TestResult object but returns a new one with the updated summary.
 * The duration is only calculated if both startTime and endTime are present in the test result.
 */
export const updateTestResultSummary = (testResult: TestResult): TestResult => {
  const { stepResults } = testResult;
  
  // Count steps by status
  const totalSteps = stepResults.length;
  const passedSteps = stepResults.filter(sr => sr.status === StepStatus.PASSED).length;
  const failedSteps = stepResults.filter(sr => sr.status === StepStatus.FAILED).length;
  const skippedSteps = stepResults.filter(sr => sr.status === StepStatus.SKIPPED).length;
  const errorSteps = stepResults.filter(sr => sr.status === StepStatus.ERROR).length;
  
  // Calculate duration if test is complete
  let duration = 0;
  if (testResult.endTime && testResult.startTime) {
    duration = testResult.endTime.getTime() - testResult.startTime.getTime();
  }
  
  // Update the summary
  return {
    ...testResult,
    summary: {
      totalSteps,
      passedSteps,
      failedSteps,
      skippedSteps,
      errorSteps,
      duration
    }
  };
};