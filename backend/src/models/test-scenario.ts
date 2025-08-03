/**
 * Represents a test scenario created by a user.
 * A test scenario is a sequence of steps that define a test case.
 *
 * @interface TestScenario
 * @property {string} id - Unique identifier for the test scenario
 * @property {string} name - Name of the test scenario
 * @property {string} [description] - Optional description of the test scenario
 * @property {Date} createdAt - Date when the test scenario was created
 * @property {Date} updatedAt - Date when the test scenario was last updated
 * @property {TestStep[]} steps - Array of test steps that make up the scenario
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
 * Enum representing the types of test steps that can be performed in a test scenario.
 * Each type corresponds to a specific action or assertion in the testing process.
 *
 * @enum {string}
 * @readonly
 * @property {string} NAVIGATE - Navigate to a specific URL
 * @property {string} INPUT - Input text into a form field or other element
 * @property {string} CLICK - Click on an element
 * @property {string} ASSERT_TEXT - Assert that an element contains specific text
 * @property {string} ASSERT_VISIBLE - Assert that an element is visible or not visible
 * @property {string} WAIT - Wait for a specified amount of time
 * @property {string} ASSERT_URL - Assert that the current URL matches an expected URL
 * @property {string} SCREENSHOT - Take a screenshot of the current page
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
 * Base interface for all test steps.
 * This interface defines the common properties that all test step types share.
 * Specific step types extend this interface with additional properties.
 *
 * @interface BaseTestStep
 * @property {string} id - Unique identifier for the test step
 * @property {TestStepType} type - The type of test step (e.g., navigate, click, input)
 * @property {string} [description] - Optional description of what the step does
 * @property {boolean} [takeScreenshot] - Whether to take a screenshot after executing this step
 */
export interface BaseTestStep {
    id: string;
    type: TestStepType;
    description?: string;
    takeScreenshot?: boolean;
}

/**
 * Interface representing a navigation step in a test scenario.
 * This step type is used to navigate to a specific URL.
 *
 * @interface NavigateStep
 * @extends {BaseTestStep}
 * @property {TestStepType.NAVIGATE} type - The step type, always NAVIGATE for this interface
 * @property {string} url - The URL to navigate to
 */
export interface NavigateStep extends BaseTestStep {
    type: TestStepType.NAVIGATE;
    url: string;
}

/**
 * Interface representing an input step in a test scenario.
 * This step type is used to input text into a specific element on the page.
 *
 * @interface InputStep
 * @extends {BaseTestStep}
 * @property {TestStepType.INPUT} type - The step type, always INPUT for this interface
 * @property {string} selector - CSS or XPath selector for the element to input text into
 * @property {string} text - The text to input into the selected element
 */
export interface InputStep extends BaseTestStep {
    type: TestStepType.INPUT;
    selector: string;
    text: string;
}

/**
 * Interface representing a click step in a test scenario.
 * This step type is used to click on a specific element on the page.
 *
 * @interface ClickStep
 * @extends {BaseTestStep}
 * @property {TestStepType.CLICK} type - The step type, always CLICK for this interface
 * @property {string} selector - CSS or XPath selector for the element to click on
 */
export interface ClickStep extends BaseTestStep {
    type: TestStepType.CLICK;
    selector: string;
}

/**
 * Interface representing an assertion step that checks if an element contains specific text.
 * This step type is used to verify that a specific element on the page contains the expected text.
 *
 * @interface AssertTextStep
 * @extends {BaseTestStep}
 * @property {TestStepType.ASSERT_TEXT} type - The step type, always ASSERT_TEXT for this interface
 * @property {string} selector - CSS or XPath selector for the element to check
 * @property {string} text - The text to look for in the selected element
 * @property {boolean} [exactMatch] - If true, the element's text must exactly match the specified text;
 *                                   if false or undefined, a partial match is sufficient
 */
export interface AssertTextStep extends BaseTestStep {
    type: TestStepType.ASSERT_TEXT;
    selector: string;
    text: string;
    exactMatch?: boolean;
}

/**
 * Interface representing an assertion step that checks if an element is visible.
 * This step type is used to verify the visibility state of a specific element on the page.
 *
 * @interface AssertVisibleStep
 * @extends {BaseTestStep}
 * @property {TestStepType.ASSERT_VISIBLE} type - The step type, always ASSERT_VISIBLE for this interface
 * @property {string} selector - CSS or XPath selector for the element to check visibility
 * @property {boolean} shouldBeVisible - If true, the test passes when the element is visible;
 *                                      if false, the test passes when the element is not visible
 */
export interface AssertVisibleStep extends BaseTestStep {
    type: TestStepType.ASSERT_VISIBLE;
    selector: string;
    shouldBeVisible: boolean;
}

/**
 * Interface representing a wait step in a test scenario.
 * This step type is used to pause test execution for a specified amount of time.
 *
 * @interface WaitStep
 * @extends {BaseTestStep}
 * @property {TestStepType.WAIT} type - The step type, always WAIT for this interface
 * @property {number} milliseconds - The number of milliseconds to wait before proceeding to the next step
 */
export interface WaitStep extends BaseTestStep {
    type: TestStepType.WAIT;
    milliseconds: number;
}

/**
 * Interface representing an assertion step that checks if the current URL matches an expected URL.
 * This step type is used to verify that the browser has navigated to the expected page.
 *
 * @interface AssertUrlStep
 * @extends {BaseTestStep}
 * @property {TestStepType.ASSERT_URL} type - The step type, always ASSERT_URL for this interface
 * @property {string} url - The expected URL to compare against the current browser URL
 * @property {boolean} [exactMatch] - If true, the current URL must exactly match the expected URL;
 *                                   if false or undefined, the current URL only needs to contain the expected URL
 */
export interface AssertUrlStep extends BaseTestStep {
    type: TestStepType.ASSERT_URL;
    url: string;
    exactMatch?: boolean;
}

/**
 * Interface representing a screenshot step in a test scenario.
 * This step type is used to capture a screenshot of the current page state.
 *
 * @interface ScreenshotStep
 * @extends {BaseTestStep}
 * @property {TestStepType.SCREENSHOT} type - The step type, always SCREENSHOT for this interface
 * @property {string} [name] - Optional name for the screenshot file; if not provided, a default name will be generated
 */
export interface ScreenshotStep extends BaseTestStep {
    type: TestStepType.SCREENSHOT;
    name?: string;
}

/**
 * Union type representing all possible test step types that can be used in a test scenario.
 * This type is used to define the steps array in the TestScenario interface.
 *
 * @typedef {(
 *   NavigateStep |
 *   InputStep |
 *   ClickStep |
 *   AssertTextStep |
 *   AssertVisibleStep |
 *   WaitStep |
 *   AssertUrlStep |
 *   ScreenshotStep
 * )} TestStep
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
 * Creates a new test scenario with the specified name, description, and steps.
 * Automatically generates a unique ID and sets creation/update timestamps.
 *
 * @function createTestScenario
 * @param {string} name - The name of the test scenario
 * @param {string} [description] - Optional description of the test scenario
 * @param {TestStep[]} [steps=[]] - Array of test steps to include in the scenario (defaults to empty array)
 * @returns {TestScenario} A new TestScenario object with the specified properties and auto-generated ID and timestamps
 *
 * @example
 * // Create a simple test scenario with a name and description
 * const scenario = createTestScenario('Login Test', 'Tests the user login functionality');
 *
 * @example
 * // Create a test scenario with steps
 * const loginScenario = createTestScenario('Login Test', 'Tests the user login functionality', [
 *   { id: 'step1', type: TestStepType.NAVIGATE, url: 'https://example.com/login' },
 *   { id: 'step2', type: TestStepType.INPUT, selector: '#username', text: 'testuser' },
 *   { id: 'step3', type: TestStepType.INPUT, selector: '#password', text: 'password123' },
 *   { id: 'step4', type: TestStepType.CLICK, selector: '#login-button' }
 * ]);
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