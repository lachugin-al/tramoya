import { TestScenario } from './test-scenario';

/**
 * Status of a test execution
 */
export enum TestStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PASSED = 'passed',
  FAILED = 'failed',
  ERROR = 'error'
}

/**
 * Status of a test step execution
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
 * Log entry for a test step
 */
export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

/**
 * Screenshot taken during test execution
 */
export interface Screenshot {
  id: string;
  stepId: string;
  timestamp: Date;
  path: string;
  url?: string; // Presigned URL for frontend access
}

/**
 * Result of a test step execution
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
 * Result of a test execution
 */
export interface TestResult {
  id: string;
  testId: string;
  status: TestStatus;
  startTime: Date;
  endTime?: Date;
  stepResults: StepResult[];
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
 * Create a new test result
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
 * Update the summary of a test result
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