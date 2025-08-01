/**
 * Types of test steps that can be performed
 */
export enum TestStepType {
  NAVIGATE = 'navigate',
  INPUT = 'input',
  CLICK = 'click',
  ASSERT_TEXT = 'assertText',
  ASSERT_VISIBLE = 'assertVisible',
  WAIT = 'wait',
  ASSERT_URL = 'assertUrl',
  SCREENSHOT = 'screenshot'
}

/**
 * Base interface for all test steps
 */
export interface BaseTestStep {
  id: string;
  type: TestStepType;
  description?: string;
  takeScreenshot?: boolean;
}

/**
 * Navigate to a URL
 */
export interface NavigateStep extends BaseTestStep {
  type: TestStepType.NAVIGATE;
  url: string;
}

/**
 * Input text into an element
 */
export interface InputStep extends BaseTestStep {
  type: TestStepType.INPUT;
  selector: string;
  text: string;
}

/**
 * Click on an element
 */
export interface ClickStep extends BaseTestStep {
  type: TestStepType.CLICK;
  selector: string;
}

/**
 * Assert that an element contains specific text
 */
export interface AssertTextStep extends BaseTestStep {
  type: TestStepType.ASSERT_TEXT;
  selector: string;
  text: string;
  exactMatch?: boolean;
}

/**
 * Assert that an element is visible
 */
export interface AssertVisibleStep extends BaseTestStep {
  type: TestStepType.ASSERT_VISIBLE;
  selector: string;
  shouldBeVisible: boolean;
}

/**
 * Wait for a specified amount of time
 */
export interface WaitStep extends BaseTestStep {
  type: TestStepType.WAIT;
  milliseconds: number;
}

/**
 * Assert that the current URL matches the expected URL
 */
export interface AssertUrlStep extends BaseTestStep {
  type: TestStepType.ASSERT_URL;
  url: string;
  exactMatch?: boolean;
}

/**
 * Take a screenshot
 */
export interface ScreenshotStep extends BaseTestStep {
  type: TestStepType.SCREENSHOT;
  name?: string;
}

/**
 * Union type of all possible test steps
 */
export type TestStep =
  | NavigateStep
  | InputStep
  | ClickStep
  | AssertTextStep
  | AssertVisibleStep
  | WaitStep
  | AssertUrlStep
  | ScreenshotStep;

/**
 * Represents a test scenario created by a user
 */
export interface TestScenario {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  steps: TestStep[];
}

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
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

/**
 * Screenshot taken during test execution
 */
export interface Screenshot {
  id: string;
  stepId: string;
  timestamp: string;
  path: string;
  url?: string;
}

/**
 * Result of a test step execution
 */
export interface StepResult {
  stepId: string;
  status: StepStatus;
  startTime?: string;
  endTime?: string;
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
  startTime: string;
  endTime?: string;
  stepResults: StepResult[];
  summary?: {
    totalSteps: number;
    passedSteps: number;
    failedSteps: number;
    skippedSteps: number;
    errorSteps: number;
    duration: number;
  };
}