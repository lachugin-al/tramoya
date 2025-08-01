/**
 * Represents a test scenario created by a user
 */
export interface TestScenario {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  steps: TestStep[];
}

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
 * Create a new test scenario
 */
export const createTestScenario = (
  name: string,
  description?: string,
  steps: TestStep[] = []
): TestScenario => {
  const now = new Date();
  return {
    id: `test_${now.getTime()}`,
    name,
    description,
    createdAt: now,
    updatedAt: now,
    steps
  };
};