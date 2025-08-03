/**
 * Types module for the application
 * 
 * This module contains all the TypeScript type definitions used throughout the application,
 * including enums, interfaces, and type aliases for test steps, test scenarios, test results,
 * and related entities.
 * 
 * @module types
 */

/**
 * Enumeration of all possible test step types that can be performed in a test scenario
 * 
 * Each type represents a specific action or assertion that can be performed during test execution.
 * 
 * @enum {string}
 */
export enum TestStepType {
  /** Navigate to a specific URL */
  NAVIGATE = 'navigate',
  
  /** Input text into a form field or other element */
  INPUT = 'input',
  
  /** Click on an element */
  CLICK = 'click',
  
  /** Assert that an element contains specific text */
  ASSERT_TEXT = 'assertText',
  
  /** Assert that an element is visible or not visible */
  ASSERT_VISIBLE = 'assertVisible',
  
  /** Wait for a specified amount of time */
  WAIT = 'wait',
  
  /** Assert that the current URL matches the expected URL */
  ASSERT_URL = 'assertUrl',
  
  /** Take a screenshot */
  SCREENSHOT = 'screenshot'
}

/**
 * Base interface for all test steps
 * 
 * This interface defines the common properties that all test steps must have,
 * regardless of their specific type.
 * 
 * @interface BaseTestStep
 * @property {string} id - Unique identifier for the step
 * @property {TestStepType} type - The type of step (determines which specific step interface applies)
 * @property {string} [description] - Optional human-readable description of the step
 * @property {boolean} [takeScreenshot] - Whether to take a screenshot after executing this step
 */
export interface BaseTestStep {
  id: string;
  type: TestStepType;
  description?: string;
  takeScreenshot?: boolean;
}

/**
 * Step for navigating to a URL
 * 
 * @interface NavigateStep
 * @extends {BaseTestStep}
 * @property {TestStepType.NAVIGATE} type - Must be TestStepType.NAVIGATE
 * @property {string} url - The URL to navigate to
 * 
 * @example
 * const navigateStep: NavigateStep = {
 *   id: 'step1',
 *   type: TestStepType.NAVIGATE,
 *   description: 'Navigate to the login page',
 *   url: 'https://example.com/login'
 * };
 */
export interface NavigateStep extends BaseTestStep {
  type: TestStepType.NAVIGATE;
  url: string;
}

/**
 * Step for inputting text into an element
 * 
 * @interface InputStep
 * @extends {BaseTestStep}
 * @property {TestStepType.INPUT} type - Must be TestStepType.INPUT
 * @property {string} selector - CSS selector for the element to input text into
 * @property {string} text - The text to input
 * 
 * @example
 * const inputStep: InputStep = {
 *   id: 'step2',
 *   type: TestStepType.INPUT,
 *   description: 'Enter username',
 *   selector: '#username',
 *   text: 'testuser'
 * };
 */
export interface InputStep extends BaseTestStep {
  type: TestStepType.INPUT;
  selector: string;
  text: string;
}

/**
 * Step for clicking on an element
 * 
 * @interface ClickStep
 * @extends {BaseTestStep}
 * @property {TestStepType.CLICK} type - Must be TestStepType.CLICK
 * @property {string} selector - CSS selector for the element to click
 * 
 * @example
 * const clickStep: ClickStep = {
 *   id: 'step3',
 *   type: TestStepType.CLICK,
 *   description: 'Click login button',
 *   selector: '#login-button'
 * };
 */
export interface ClickStep extends BaseTestStep {
  type: TestStepType.CLICK;
  selector: string;
}

/**
 * Step for asserting that an element contains specific text
 * 
 * @interface AssertTextStep
 * @extends {BaseTestStep}
 * @property {TestStepType.ASSERT_TEXT} type - Must be TestStepType.ASSERT_TEXT
 * @property {string} selector - CSS selector for the element to check
 * @property {string} text - The text to check for
 * @property {boolean} [exactMatch] - Whether the text must match exactly (true) or can be a substring (false)
 * 
 * @example
 * const assertTextStep: AssertTextStep = {
 *   id: 'step4',
 *   type: TestStepType.ASSERT_TEXT,
 *   description: 'Verify welcome message',
 *   selector: '.welcome-message',
 *   text: 'Welcome, testuser',
 *   exactMatch: true
 * };
 */
export interface AssertTextStep extends BaseTestStep {
  type: TestStepType.ASSERT_TEXT;
  selector: string;
  text: string;
  exactMatch?: boolean;
}

/**
 * Step for asserting that an element is visible or not visible
 * 
 * @interface AssertVisibleStep
 * @extends {BaseTestStep}
 * @property {TestStepType.ASSERT_VISIBLE} type - Must be TestStepType.ASSERT_VISIBLE
 * @property {string} selector - CSS selector for the element to check
 * @property {boolean} shouldBeVisible - Whether the element should be visible (true) or not visible (false)
 * 
 * @example
 * const assertVisibleStep: AssertVisibleStep = {
 *   id: 'step5',
 *   type: TestStepType.ASSERT_VISIBLE,
 *   description: 'Verify error message is not visible',
 *   selector: '.error-message',
 *   shouldBeVisible: false
 * };
 */
export interface AssertVisibleStep extends BaseTestStep {
  type: TestStepType.ASSERT_VISIBLE;
  selector: string;
  shouldBeVisible: boolean;
}

/**
 * Step for waiting a specified amount of time
 * 
 * @interface WaitStep
 * @extends {BaseTestStep}
 * @property {TestStepType.WAIT} type - Must be TestStepType.WAIT
 * @property {number} milliseconds - The number of milliseconds to wait
 * 
 * @example
 * const waitStep: WaitStep = {
 *   id: 'step6',
 *   type: TestStepType.WAIT,
 *   description: 'Wait for animation to complete',
 *   milliseconds: 500
 * };
 */
export interface WaitStep extends BaseTestStep {
  type: TestStepType.WAIT;
  milliseconds: number;
}

/**
 * Step for asserting that the current URL matches the expected URL
 * 
 * @interface AssertUrlStep
 * @extends {BaseTestStep}
 * @property {TestStepType.ASSERT_URL} type - Must be TestStepType.ASSERT_URL
 * @property {string} url - The expected URL
 * @property {boolean} [exactMatch] - Whether the URL must match exactly (true) or can be a substring (false)
 * 
 * @example
 * const assertUrlStep: AssertUrlStep = {
 *   id: 'step7',
 *   type: TestStepType.ASSERT_URL,
 *   description: 'Verify we are on the dashboard page',
 *   url: 'https://example.com/dashboard',
 *   exactMatch: true
 * };
 */
export interface AssertUrlStep extends BaseTestStep {
  type: TestStepType.ASSERT_URL;
  url: string;
  exactMatch?: boolean;
}

/**
 * Step for taking a screenshot
 * 
 * @interface ScreenshotStep
 * @extends {BaseTestStep}
 * @property {TestStepType.SCREENSHOT} type - Must be TestStepType.SCREENSHOT
 * @property {string} [name] - Optional name for the screenshot
 * 
 * @example
 * const screenshotStep: ScreenshotStep = {
 *   id: 'step8',
 *   type: TestStepType.SCREENSHOT,
 *   description: 'Take screenshot of dashboard',
 *   name: 'dashboard-screenshot'
 * };
 */
export interface ScreenshotStep extends BaseTestStep {
  type: TestStepType.SCREENSHOT;
  name?: string;
}

/**
 * Union type of all possible test steps
 * 
 * This type can be used to represent any type of test step in the application.
 * Type narrowing can be used to determine the specific step type at runtime.
 * 
 * @typedef {NavigateStep | InputStep | ClickStep | AssertTextStep | AssertVisibleStep | WaitStep | AssertUrlStep | ScreenshotStep} TestStep
 * 
 * @example
 * // Type narrowing example
 * function executeStep(step: TestStep) {
 *   switch (step.type) {
 *     case TestStepType.NAVIGATE:
 *       // step is now narrowed to NavigateStep
 *       console.log(`Navigating to ${step.url}`);
 *       break;
 *     case TestStepType.INPUT:
 *       // step is now narrowed to InputStep
 *       console.log(`Inputting "${step.text}" into ${step.selector}`);
 *       break;
 *     // ... handle other step types
 *   }
 * }
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
 * 
 * A test scenario is a sequence of steps that define a test case.
 * It includes metadata about the test and the steps to be executed.
 * 
 * @interface TestScenario
 * @property {string} id - Unique identifier for the test scenario
 * @property {string} name - Human-readable name of the test scenario
 * @property {string} [description] - Optional detailed description of the test scenario
 * @property {string} createdAt - ISO timestamp of when the test scenario was created
 * @property {string} updatedAt - ISO timestamp of when the test scenario was last updated
 * @property {TestStep[]} steps - Array of steps that make up the test scenario
 * 
 * @example
 * const loginTestScenario: TestScenario = {
 *   id: 'test-123',
 *   name: 'Login Test',
 *   description: 'Tests the login functionality with valid credentials',
 *   createdAt: '2023-01-01T12:00:00Z',
 *   updatedAt: '2023-01-02T14:30:00Z',
 *   steps: [
 *     {
 *       id: 'step1',
 *       type: TestStepType.NAVIGATE,
 *       description: 'Navigate to login page',
 *       url: 'https://example.com/login'
 *     },
 *     {
 *       id: 'step2',
 *       type: TestStepType.INPUT,
 *       description: 'Enter username',
 *       selector: '#username',
 *       text: 'testuser'
 *     }
 *     // ... more steps
 *   ]
 * };
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
 * 
 * Represents the current state of a test run.
 * 
 * @enum {string}
 */
export enum TestStatus {
  /** Test is queued but not yet started */
  PENDING = 'pending',
  
  /** Test is currently executing */
  RUNNING = 'running',
  
  /** Test completed successfully with all steps passing */
  PASSED = 'passed',
  
  /** Test completed but one or more steps failed */
  FAILED = 'failed',
  
  /** Test encountered an error during execution and could not complete */
  ERROR = 'error'
}

/**
 * Status of a test step execution
 * 
 * Represents the current state of an individual test step.
 * 
 * @enum {string}
 */
export enum StepStatus {
  /** Step is queued but not yet started */
  PENDING = 'pending',
  
  /** Step is currently executing */
  RUNNING = 'running',
  
  /** Step completed successfully */
  PASSED = 'passed',
  
  /** Step completed but the assertion failed */
  FAILED = 'failed',
  
  /** Step was skipped (usually because a previous step failed) */
  SKIPPED = 'skipped',
  
  /** Step encountered an error during execution and could not complete */
  ERROR = 'error'
}

/**
 * Log entry for a test step
 * 
 * Represents a single log message generated during test execution.
 * 
 * @interface LogEntry
 * @property {string} timestamp - ISO timestamp of when the log entry was created
 * @property {'info' | 'warn' | 'error' | 'debug'} level - Severity level of the log entry
 * @property {string} message - The log message content
 * 
 * @example
 * const logEntry: LogEntry = {
 *   timestamp: '2023-01-01T12:00:00Z',
 *   level: 'info',
 *   message: 'Navigating to https://example.com/login'
 * };
 */
export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

/**
 * Screenshot taken during test execution
 * 
 * Represents a screenshot captured during the execution of a test step.
 * 
 * @interface Screenshot
 * @property {string} id - Unique identifier for the screenshot
 * @property {string} stepId - ID of the step during which the screenshot was taken
 * @property {string} timestamp - ISO timestamp of when the screenshot was taken
 * @property {string} path - Relative path to the screenshot file on the server
 * @property {string} [url] - Optional full URL to access the screenshot
 * 
 * @example
 * const screenshot: Screenshot = {
 *   id: 'screenshot-123',
 *   stepId: 'step1',
 *   timestamp: '2023-01-01T12:00:05Z',
 *   path: '/screenshots/run-456/step1-screenshot.png',
 *   url: 'https://example.com/api/screenshots/run-456/step1-screenshot.png'
 * };
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
 * 
 * Contains all information about the execution of a single test step,
 * including status, timing, logs, screenshots, and any errors.
 * 
 * @interface StepResult
 * @property {string} stepId - ID of the step this result is for
 * @property {StepStatus} status - Current status of the step
 * @property {string} [startTime] - Optional ISO timestamp of when the step started executing
 * @property {string} [endTime] - Optional ISO timestamp of when the step finished executing
 * @property {LogEntry[]} logs - Array of log entries generated during step execution
 * @property {Screenshot[]} screenshots - Array of screenshots taken during step execution
 * @property {Object} [error] - Optional error information if the step failed or encountered an error
 * @property {string} error.message - Error message
 * @property {string} [error.stack] - Optional stack trace for the error
 * 
 * @example
 * const stepResult: StepResult = {
 *   stepId: 'step1',
 *   status: StepStatus.PASSED,
 *   startTime: '2023-01-01T12:00:00Z',
 *   endTime: '2023-01-01T12:00:05Z',
 *   logs: [
 *     {
 *       timestamp: '2023-01-01T12:00:01Z',
 *       level: 'info',
 *       message: 'Navigating to https://example.com/login'
 *     }
 *   ],
 *   screenshots: [
 *     {
 *       id: 'screenshot-123',
 *       stepId: 'step1',
 *       timestamp: '2023-01-01T12:00:05Z',
 *       path: '/screenshots/run-456/step1-screenshot.png'
 *     }
 *   ]
 * };
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
 * 
 * Contains all information about the execution of a test scenario,
 * including overall status, timing, step results, and artifacts.
 * 
 * @interface TestResult
 * @property {string} id - Unique identifier for the test result
 * @property {string} testId - ID of the test scenario this result is for
 * @property {TestStatus} status - Current status of the test
 * @property {string} startTime - ISO timestamp of when the test started executing
 * @property {string} [endTime] - Optional ISO timestamp of when the test finished executing
 * @property {StepResult[]} stepResults - Array of results for each step in the test
 * @property {string} [videoUrl] - Optional URL to a video recording of the test execution
 * @property {string} [traceUrl] - Optional URL to a trace file for debugging
 * @property {Object} [summary] - Optional summary statistics for the test
 * @property {number} summary.totalSteps - Total number of steps in the test
 * @property {number} summary.passedSteps - Number of steps that passed
 * @property {number} summary.failedSteps - Number of steps that failed
 * @property {number} summary.skippedSteps - Number of steps that were skipped
 * @property {number} summary.errorSteps - Number of steps that encountered errors
 * @property {number} summary.duration - Total duration of the test in milliseconds
 * 
 * @example
 * const testResult: TestResult = {
 *   id: 'result-789',
 *   testId: 'test-123',
 *   status: TestStatus.PASSED,
 *   startTime: '2023-01-01T12:00:00Z',
 *   endTime: '2023-01-01T12:01:30Z',
 *   stepResults: [
 *     // ... step results
 *   ],
 *   videoUrl: 'https://example.com/api/videos/run-456/recording.mp4',
 *   traceUrl: 'https://example.com/api/traces/run-456/trace.json',
 *   summary: {
 *     totalSteps: 5,
 *     passedSteps: 5,
 *     failedSteps: 0,
 *     skippedSteps: 0,
 *     errorSteps: 0,
 *     duration: 90000 // 90 seconds
 *   }
 * };
 */
export interface TestResult {
  id: string;
  testId: string;
  status: TestStatus;
  startTime: string;
  endTime?: string;
  stepResults: StepResult[];
  videoUrl?: string; // URL to video recording
  traceUrl?: string; // URL to trace file
  summary?: {
    totalSteps: number;
    passedSteps: number;
    failedSteps: number;
    skippedSteps: number;
    errorSteps: number;
    duration: number;
  };
}