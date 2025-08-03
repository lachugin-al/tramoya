import {chromium, Browser, Page, BrowserContext} from 'playwright';
import {v4 as uuidv4} from 'uuid';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {createLogger} from '../utils/logger';
import {
    TestScenario,
    TestStep,
    TestStepType,
    NavigateStep,
    InputStep,
    ClickStep,
    AssertTextStep,
    AssertVisibleStep,
    WaitStep,
    AssertUrlStep,
    ScreenshotStep
} from '../models/test-scenario';
import {
    TestResult,
    TestStatus,
    StepStatus,
    StepResult,
    LogEntry,
    Screenshot,
    createTestResult,
    updateTestResultSummary
} from '../models/test-result';
import {MinioService} from './minio-service';
import {RedisService} from './redis-service';
import {EVENT_CHANNELS} from './queue-service';
import {
    TestEventType,
    createStepStartEvent,
    createFrameEvent,
    createStepEndEvent,
    createRunFinishedEvent
} from '../models/test-events';
import {finalizeRunIfNeeded, notifyClients} from './stream-manager';

// Logger for the test runner
const logger = createLogger('test-runner');

// Directory for temporary screenshots
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || path.join(__dirname, '../../screenshots');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, {recursive: true});
}

/**
 * Service for executing automated test scenarios using Playwright
 *
 * @class TestRunner
 * @description A comprehensive test execution service that runs test scenarios using Playwright.
 * This class is responsible for:
 *
 * - Managing browser instances and contexts
 * - Executing test scenarios and their individual steps
 * - Capturing screenshots, videos, and traces during test execution
 * - Recording detailed logs of test execution
 * - Publishing events about test progress and results
 * - Storing test artifacts in Minio/S3 storage
 * - Saving test results in Redis
 *
 * The TestRunner supports various test step types including navigation, input, clicking,
 * assertions, waiting, and screenshots. It handles both successful and failed test executions,
 * providing detailed information about failures.
 *
 * Test execution results include:
 * - Overall test status (passed, failed, error)
 * - Individual step results with status and timing information
 * - Screenshots captured during execution
 * - Video recording of the entire test
 * - Playwright trace for detailed debugging
 * - Logs of actions and errors
 */
export class TestRunner {
    private browser: Browser | null = null;
    private minioService: MinioService;
    private redisService: RedisService | null = null;
    private tempDir: string;

    /**
     * Creates a new TestRunner instance
     *
     * @constructor
     * @description Initializes a new TestRunner with the required services and creates
     * a temporary directory for storing test artifacts during execution.
     *
     * @param {MinioService} minioService - Service for storing test artifacts (screenshots, videos, traces)
     * @param {RedisService} [redisService] - Optional service for storing test results and publishing events
     */
    constructor(minioService: MinioService, redisService?: RedisService) {
        this.minioService = minioService;
        this.redisService = redisService || null;

        // Create temporary directory for artifacts
        this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tramoya-'));
        logger.info(`Created temporary directory: ${this.tempDir}`);
    }

    /**
     * Initializes the Playwright browser instance
     *
     * @method initBrowser
     * @description Initializes a headless Chromium browser instance using Playwright if one
     * doesn't already exist. This method is called internally before test execution to ensure
     * a browser is available.
     *
     * The browser is launched in headless mode, making it suitable for running in environments
     * without a display, such as CI/CD pipelines or server environments.
     *
     * @returns {Promise<Browser>} A promise that resolves to the Playwright Browser instance
     * @private
     */
    private async initBrowser(): Promise<Browser> {
        if (!this.browser) {
            logger.info('Initializing browser');
            this.browser = await chromium.launch({
                headless: true
            });
        }
        return this.browser;
    }

    /**
     * Closes the Playwright browser instance
     *
     * @method closeBrowser
     * @description Gracefully closes the Playwright browser instance if one is open.
     * This method should be called when the TestRunner is no longer needed to free up resources.
     *
     * It's important to call this method to ensure proper cleanup of browser resources,
     * especially in long-running applications to prevent memory leaks.
     *
     * If no browser is currently open, this method does nothing.
     *
     * @returns {Promise<void>} A promise that resolves when the browser has been closed
     * @public
     */
    public async closeBrowser(): Promise<void> {
        if (this.browser) {
            logger.info('Closing browser');
            await this.browser.close();
            this.browser = null;
        }
    }

    /**
     * Executes a test scenario using Playwright
     *
     * @method executeTest
     * @description Runs a complete test scenario by executing each step in sequence.
     * This is the main method of the TestRunner class and orchestrates the entire test execution process.
     *
     * The method performs the following operations:
     * 1. Initializes a browser and creates a new page
     * 2. Sets up video recording and tracing
     * 3. Executes each test step in sequence
     * 4. Captures screenshots, especially on failures
     * 5. Records a video of the entire test execution
     * 6. Creates a Playwright trace for debugging
     * 7. Uploads artifacts to Minio storage
     * 8. Saves the test result to Redis (if RedisService is provided)
     * 9. Publishes events about test progress and completion
     *
     * If any step fails, the test execution continues with the remaining steps to gather
     * as much information as possible, but the overall test result will be marked as failed.
     *
     * @param {TestScenario} testScenario - The test scenario to execute
     * @param {string} [runId] - Optional unique identifier for this test run (used for event correlation)
     * @returns {Promise<TestResult>} A promise that resolves to the complete test result
     * @public
     */
    public async executeTest(testScenario: TestScenario, runId?: string): Promise<TestResult> {
        logger.info(`Executing test: ${testScenario.id} - ${testScenario.name}`);

        // Create initial test result
        const testResult = createTestResult(testScenario);
        testResult.status = TestStatus.RUNNING;

        // Use provided runId or test result id
        const testRunId = runId || testResult.id;

        // Set the runId on the test result for consistency
        testResult.runId = testRunId;

        // Paths for artifacts
        const videoPath = path.join(this.tempDir, `${testRunId}_video.webm`);
        const tracePath = path.join(this.tempDir, `${testRunId}_trace.zip`);

        let context: BrowserContext | null = null;
        let page: Page | null = null;

        try {
            // Initialize browser
            const browser = await this.initBrowser();

            // Create context with video recording
            context = await browser.newContext({
                recordVideo: {
                    dir: this.tempDir,
                    size: {width: 1366, height: 768}
                }
            });

            // Start tracing
            await context.tracing.start({
                screenshots: true,
                snapshots: true
            });

            // Create page
            page = await context.newPage();

            // Execute each step
            for (let i = 0; i < testScenario.steps.length; i++) {
                const step = testScenario.steps[i];
                const stepResult = testResult.stepResults[i];

                // Update step status
                stepResult.status = StepStatus.RUNNING;
                stepResult.startTime = new Date();

                // Emit step start event
                await this.emitEvent(createStepStartEvent(
                    testRunId,
                    step.id,
                    i,
                    step.type
                ));

                try {
                    // Execute the step
                    await this.executeStep(page, step, stepResult);

                    // Take screenshot after step
                    const screenshot = await this.takeScreenshot(page, step.id, stepResult);

                    // Emit frame event if screenshot was taken and has a URL
                    if (screenshot && screenshot.url) {
                        await this.emitEvent(createFrameEvent(
                            testRunId,
                            step.id,
                            screenshot.url,
                            screenshot.path
                        ));
                    }

                    // Mark step as passed
                    stepResult.status = StepStatus.PASSED;

                    // Emit step end event
                    await this.emitEvent(createStepEndEvent(
                        testRunId,
                        step.id,
                        StepStatus.PASSED
                    ));

                    // Publish step event
                    await this.publishStepEvent(
                        testRunId,
                        step.id,
                        stepResult.status,
                        screenshot?.url
                    );

                    // Check if run should be finalized
                    if (this.redisService) {
                        await finalizeRunIfNeeded(testResult, this.redisService);
                    }
                } catch (error) {
                    // Mark step as failed
                    stepResult.status = StepStatus.FAILED;
                    stepResult.error = {
                        message: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined
                    };

                    // Add error log
                    this.addLog(stepResult, 'error', `Step failed: ${stepResult.error.message}`);

                    // Take screenshot on failure
                    const errorScreenshot = await this.takeScreenshot(page, step.id, stepResult, 'error');

                    // Emit frame event for error screenshot if it has a URL
                    if (errorScreenshot && errorScreenshot.url) {
                        await this.emitEvent(createFrameEvent(
                            testRunId,
                            step.id,
                            errorScreenshot.url,
                            errorScreenshot.path
                        ));
                    }

                    // Emit step end event
                    await this.emitEvent(createStepEndEvent(
                        testRunId,
                        step.id,
                        StepStatus.FAILED,
                    ));

                    // Publish step event
                    await this.publishStepEvent(
                        testRunId,
                        step.id,
                        stepResult.status,
                        errorScreenshot?.url
                    );

                    // Check if run should be finalized
                    if (this.redisService) {
                        await finalizeRunIfNeeded(testResult, this.redisService);
                    }

                    // Skip remaining steps
                    for (let j = i + 1; j < testScenario.steps.length; j++) {
                        testResult.stepResults[j].status = StepStatus.SKIPPED;
                    }

                    // Mark test as failed
                    testResult.status = TestStatus.FAILED;
                    break;
                } finally {
                    // Update step end time
                    stepResult.endTime = new Date();
                }
            }

            // Stop tracing and save to file
            await context.tracing.stop({path: tracePath});

            // Close page and context (this will finish video recording)
            await page.close();
            await context.close();

            // If test wasn't marked as failed, mark it as passed
            if (testResult.status === TestStatus.RUNNING) {
                testResult.status = TestStatus.PASSED;
            }

            // Upload video and trace to MinIO
            const videoObjectName = `runs/${testRunId}/video.webm`;
            const traceObjectName = `runs/${testRunId}/trace.zip`;

            // Wait for video file to be available (it's created asynchronously)
            // Instead of a fixed delay, we'll check if the file exists in a loop
            for (let i = 0; i < 10 && !fs.existsSync(videoPath); i++) {
                logger.debug(`Waiting for video file to be available (attempt ${i + 1}/10)`);
                await new Promise(r => setTimeout(r, 500));
            }

            // Upload artifacts if they exist
            let videoUrl: string | undefined;
            let traceUrl: string | undefined;

            if (fs.existsSync(videoPath)) {
                await this.minioService.uploadFile(videoPath, videoObjectName);
                videoUrl = this.minioService.getPublicUrl(videoObjectName);
                testResult.videoUrl = videoUrl;
            }

            if (fs.existsSync(tracePath)) {
                await this.minioService.uploadFile(tracePath, traceObjectName);
                traceUrl = this.minioService.getPublicUrl(traceObjectName);
                testResult.traceUrl = traceUrl;
            }

            // Emit run finished event
            await this.emitEvent(createRunFinishedEvent(
                testRunId,
                testResult.status,
                videoUrl,
                traceUrl
            ));

            // Publish run finished event
            await this.publishRunFinished(
                testRunId,
                testResult.status,
                videoUrl,
                traceUrl
            );
        } catch (error) {
            // Handle unexpected errors
            logger.error(`Error executing test: ${error instanceof Error ? error.message : String(error)}`);
            testResult.status = TestStatus.ERROR;

            // Emit run finished event with error status
            await this.emitEvent(createRunFinishedEvent(
                testRunId,
                StepStatus.ERROR
            ));

            // Publish run finished event with error status
            await this.publishRunFinished(
                testRunId,
                TestStatus.ERROR
            );
        } finally {
            // Clean up if needed
            if (page && !page.isClosed()) await page.close();
            if (context) await context.close();

            // Update test end time
            testResult.endTime = new Date();

            // Update test summary
            updateTestResultSummary(testResult);

            // Clean up temporary files
            try {
                if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
                if (fs.existsSync(tracePath)) fs.unlinkSync(tracePath);
            } catch (error) {
                logger.warn(`Error cleaning up temporary files: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        return testResult;
    }

    /**
     * Executes a single test step based on its type
     *
     * @method executeStep
     * @description Executes a test step by delegating to the appropriate specialized method
     * based on the step type. This method serves as a router that directs each step to its
     * specific implementation.
     *
     * The method handles all supported step types:
     * - NAVIGATE: Navigate to a URL
     * - INPUT: Enter text into a field
     * - CLICK: Click on an element
     * - ASSERT_TEXT: Verify text content
     * - ASSERT_VISIBLE: Verify element visibility
     * - WAIT: Wait for a specified time
     * - ASSERT_URL: Verify current URL
     * - SCREENSHOT: Take a screenshot
     *
     * If the step has the takeScreenshot flag set to true, a screenshot will be taken
     * after the step execution regardless of the step type.
     *
     * @param {Page} page - The Playwright page object to operate on
     * @param {TestStep} step - The test step to execute
     * @param {StepResult} stepResult - The result object to update with execution details
     * @returns {Promise<void>} A promise that resolves when the step has been executed
     * @throws {Error} If the step type is unknown or if the step execution fails
     * @private
     */
    private async executeStep(page: Page, step: TestStep, stepResult: StepResult): Promise<void> {
        this.addLog(stepResult, 'info', `Executing step: ${step.type}`);

        switch (step.type) {
            case TestStepType.NAVIGATE:
                await this.executeNavigateStep(page, step as NavigateStep, stepResult);
                break;
            case TestStepType.INPUT:
                await this.executeInputStep(page, step as InputStep, stepResult);
                break;
            case TestStepType.CLICK:
                await this.executeClickStep(page, step as ClickStep, stepResult);
                break;
            case TestStepType.ASSERT_TEXT:
                await this.executeAssertTextStep(page, step as AssertTextStep, stepResult);
                break;
            case TestStepType.ASSERT_VISIBLE:
                await this.executeAssertVisibleStep(page, step as AssertVisibleStep, stepResult);
                break;
            case TestStepType.WAIT:
                await this.executeWaitStep(page, step as WaitStep, stepResult);
                break;
            case TestStepType.ASSERT_URL:
                await this.executeAssertUrlStep(page, step as AssertUrlStep, stepResult);
                break;
            case TestStepType.SCREENSHOT:
                await this.executeScreenshotStep(page, step as ScreenshotStep, stepResult);
                break;
            default:
                const exhaustiveCheck: never = step;
                throw new Error(`Unknown step type: ${(step as TestStep).type}`);
        }

        // Take screenshot if requested
        if (step.takeScreenshot) {
            await this.takeScreenshot(page, step.id, stepResult);
        }
    }

    /**
     * Executes a navigation step to load a URL in the browser
     *
     * @method executeNavigateStep
     * @description Navigates the browser to a specified URL using Playwright's page.goto method.
     * This is typically the first step in a test scenario to load the page being tested.
     *
     * The method logs the navigation action and its completion to provide a clear record
     * of the navigation process in the test results.
     *
     * @param {Page} page - The Playwright page object to navigate
     * @param {NavigateStep} step - The navigation step containing the URL to navigate to
     * @param {StepResult} stepResult - The result object to update with logs and status
     * @returns {Promise<void>} A promise that resolves when navigation is complete
     * @throws {Error} If navigation fails due to network issues, invalid URL, or timeout
     * @private
     */
    private async executeNavigateStep(page: Page, step: NavigateStep, stepResult: StepResult): Promise<void> {
        this.addLog(stepResult, 'info', `Navigating to: ${step.url}`);
        await page.goto(step.url);
        this.addLog(stepResult, 'info', `Navigation complete`);
    }

    /**
     * Executes an input step to enter text into a form field
     *
     * @method executeInputStep
     * @description Enters text into a form field or editable element identified by a CSS selector.
     * This method uses Playwright's fill method which automatically clears the field before
     * entering the new text.
     *
     * The method logs the input action and its completion to provide a clear record
     * of the text entry process in the test results.
     *
     * @param {Page} page - The Playwright page object to operate on
     * @param {InputStep} step - The input step containing the selector and text to enter
     * @param {StepResult} stepResult - The result object to update with logs and status
     * @returns {Promise<void>} A promise that resolves when the text has been entered
     * @throws {Error} If the selector doesn't match any elements or the element is not editable
     * @private
     */
    private async executeInputStep(page: Page, step: InputStep, stepResult: StepResult): Promise<void> {
        this.addLog(stepResult, 'info', `Entering text into selector: ${step.selector}`);
        await page.fill(step.selector, step.text);
        this.addLog(stepResult, 'info', `Text entered`);
    }

    /**
     * Executes a click step to interact with an element
     *
     * @method executeClickStep
     * @description Clicks on an element identified by a CSS selector using Playwright's click method.
     * This simulates a user clicking on a button, link, or other interactive element on the page.
     *
     * The method automatically waits for the element to be available and visible before
     * attempting to click it, which helps with handling dynamic content.
     *
     * The method logs the click action and its completion to provide a clear record
     * of the interaction in the test results.
     *
     * @param {Page} page - The Playwright page object to operate on
     * @param {ClickStep} step - The click step containing the selector to click on
     * @param {StepResult} stepResult - The result object to update with logs and status
     * @returns {Promise<void>} A promise that resolves when the click has been performed
     * @throws {Error} If the selector doesn't match any elements or the element is not clickable
     * @private
     */
    private async executeClickStep(page: Page, step: ClickStep, stepResult: StepResult): Promise<void> {
        this.addLog(stepResult, 'info', `Clicking on selector: ${step.selector}`);
        await page.click(step.selector);
        this.addLog(stepResult, 'info', `Click performed`);
    }

    /**
     * Executes an assertion step to verify text content on the page
     *
     * @method executeAssertTextStep
     * @description Verifies that an element identified by a CSS selector contains the expected text.
     * This method supports both exact text matching and substring matching based on the step configuration.
     *
     * The verification process follows these steps:
     * 1. Find the element using the provided selector
     * 2. Extract the text content from the element
     * 3. Compare the texts based on the matching mode (exact or contains)
     *
     * If the assertion fails, a detailed error message is thrown that includes both the
     * expected and actual text values to aid in debugging.
     *
     * @param {Page} page - The Playwright page object to operate on
     * @param {AssertTextStep} step - The assertion step containing the selector, expected text, and matching mode
     * @param {StepResult} stepResult - The result object to update with logs and status
     * @returns {Promise<void>} A promise that resolves when the assertion has been verified
     * @throws {Error} If the element is not found, has no text content, or the text doesn't match expectations
     * @private
     */
    private async executeAssertTextStep(page: Page, step: AssertTextStep, stepResult: StepResult): Promise<void> {
        this.addLog(stepResult, 'info', `Asserting text in selector: ${step.selector}`);

        const element = await page.$(step.selector);
        if (!element) {
            throw new Error(`Element not found: ${step.selector}`);
        }

        const text = await element.textContent();

        if (step.exactMatch) {
            if (text !== step.text) {
                throw new Error(`Text does not match. Expected: "${step.text}", Actual: "${text}"`);
            }
        } else {
            if (!text || !text.includes(step.text)) {
                throw new Error(`Text not found. Expected to contain: "${step.text}", Actual: "${text}"`);
            }
        }

        this.addLog(stepResult, 'info', `Text assertion passed`);
    }

    /**
     * Executes an assertion step to verify element visibility on the page
     *
     * @method executeAssertVisibleStep
     * @description Verifies that an element identified by a CSS selector is either visible or not visible,
     * depending on the step configuration. This is useful for testing UI state and conditional rendering.
     *
     * The method uses Playwright's isVisible method to determine if the element is visible in the viewport
     * and compares the result with the expected visibility state from the step configuration.
     *
     * If the assertion fails, a clear error message is thrown that indicates the expected and actual
     * visibility states to aid in debugging.
     *
     * @param {Page} page - The Playwright page object to operate on
     * @param {AssertVisibleStep} step - The assertion step containing the selector and expected visibility
     * @param {StepResult} stepResult - The result object to update with logs and status
     * @returns {Promise<void>} A promise that resolves when the visibility has been verified
     * @throws {Error} If the element's visibility state doesn't match the expected state
     * @private
     */
    private async executeAssertVisibleStep(page: Page, step: AssertVisibleStep, stepResult: StepResult): Promise<void> {
        this.addLog(stepResult, 'info', `Asserting visibility of selector: ${step.selector}`);

        const isVisible = await page.isVisible(step.selector);

        if (isVisible !== step.shouldBeVisible) {
            throw new Error(`Visibility assertion failed. Expected: ${step.shouldBeVisible}, Actual: ${isVisible}`);
        }

        this.addLog(stepResult, 'info', `Visibility assertion passed`);
    }

    /**
     * Executes a wait step to pause test execution for a specified time
     *
     * @method executeWaitStep
     * @description Pauses the test execution for a specified number of milliseconds.
     * This is useful for waiting for animations, network requests, or other asynchronous
     * operations to complete when more specific waiting conditions are not applicable.
     *
     * The method uses Playwright's waitForTimeout method which returns a promise that
     * resolves after the specified timeout.
     *
     * Note: While explicit waits are sometimes necessary, it's generally better to use
     * more specific waiting conditions like waitForSelector or waitForNavigation when possible.
     *
     * @param {Page} page - The Playwright page object to operate on
     * @param {WaitStep} step - The wait step containing the duration in milliseconds
     * @param {StepResult} stepResult - The result object to update with logs and status
     * @returns {Promise<void>} A promise that resolves when the wait period has completed
     * @private
     */
    private async executeWaitStep(page: Page, step: WaitStep, stepResult: StepResult): Promise<void> {
        this.addLog(stepResult, 'info', `Waiting for ${step.milliseconds}ms`);
        await page.waitForTimeout(step.milliseconds);
        this.addLog(stepResult, 'info', `Wait complete`);
    }

    /**
     * Executes an assertion step to verify the current page URL
     *
     * @method executeAssertUrlStep
     * @description Verifies that the current page URL matches or contains the expected URL,
     * depending on the step configuration. This is useful for confirming navigation success
     * or checking that the user is on the expected page.
     *
     * The method supports two matching modes:
     * - Exact match: The current URL must be identical to the expected URL
     * - Partial match: The current URL must contain the expected URL as a substring
     *
     * If the assertion fails, a detailed error message is thrown that includes both the
     * expected and actual URL values to aid in debugging.
     *
     * @param {Page} page - The Playwright page object to operate on
     * @param {AssertUrlStep} step - The assertion step containing the expected URL and matching mode
     * @param {StepResult} stepResult - The result object to update with logs and status
     * @returns {Promise<void>} A promise that resolves when the URL has been verified
     * @throws {Error} If the current URL doesn't match the expected URL according to the matching mode
     * @private
     */
    private async executeAssertUrlStep(page: Page, step: AssertUrlStep, stepResult: StepResult): Promise<void> {
        this.addLog(stepResult, 'info', `Asserting URL`);

        const currentUrl = page.url();

        if (step.exactMatch) {
            if (currentUrl !== step.url) {
                throw new Error(`URL does not match. Expected: "${step.url}", Actual: "${currentUrl}"`);
            }
        } else {
            if (!currentUrl.includes(step.url)) {
                throw new Error(`URL does not contain expected value. Expected to contain: "${step.url}", Actual: "${currentUrl}"`);
            }
        }

        this.addLog(stepResult, 'info', `URL assertion passed`);
    }

    /**
     * Executes a screenshot step to capture the current page state
     *
     * @method executeScreenshotStep
     * @description Takes a screenshot of the current page state and saves it as part of the test results.
     * This is useful for documenting the UI at specific points during test execution or
     * for capturing the state when assertions are made.
     *
     * The method delegates to the takeScreenshot method to handle the actual screenshot capture,
     * storage, and result updating. The screenshot is labeled with the provided name (or 'manual'
     * if no name is provided) to make it easier to identify in the test results.
     *
     * @param {Page} page - The Playwright page object to capture
     * @param {ScreenshotStep} step - The screenshot step containing the optional name for the screenshot
     * @param {StepResult} stepResult - The result object to update with logs and screenshot information
     * @returns {Promise<void>} A promise that resolves when the screenshot has been taken and saved
     * @throws {Error} If there's an error capturing or saving the screenshot
     * @private
     */
    private async executeScreenshotStep(page: Page, step: ScreenshotStep, stepResult: StepResult): Promise<void> {
        this.addLog(stepResult, 'info', `Taking screenshot`);
        await this.takeScreenshot(page, step.id, stepResult, step.name || 'manual');
        this.addLog(stepResult, 'info', `Screenshot taken`);
    }

    /**
     * Takes a screenshot of the current page and adds it to the step result
     *
     * @method takeScreenshot
     * @description Captures a screenshot of the current page, saves it temporarily to disk,
     * uploads it to Minio storage, and adds the screenshot information to the step result.
     *
     * The process follows these steps:
     * 1. Generate a unique ID and filename based on step ID, timestamp, and label
     * 2. Capture a screenshot using Playwright
     * 3. Upload the screenshot to Minio storage
     * 4. Get a public URL for accessing the screenshot
     * 5. Add the screenshot metadata to the step result
     * 6. Clean up the temporary local file
     *
     * If any error occurs during the process, it is logged but not thrown to prevent
     * the test from failing due to screenshot issues.
     *
     * @param {Page} page - The Playwright page object to capture
     * @param {string} stepId - The ID of the step this screenshot is associated with
     * @param {StepResult} stepResult - The result object to update with screenshot information
     * @param {string} [label='step'] - A label to identify the purpose of the screenshot
     * @returns {Promise<Screenshot|undefined>} A promise that resolves to the screenshot object if successful, or undefined if failed
     * @private
     */
    private async takeScreenshot(
        page: Page,
        stepId: string,
        stepResult: StepResult,
        label: string = 'step'
    ): Promise<Screenshot | undefined> {
        try {
            const timestamp = new Date();
            const screenshotId = uuidv4();
            const filename = `${stepId}_${label}_${timestamp.getTime()}.png`;
            const filepath = path.join(SCREENSHOT_DIR, filename);

            // Take screenshot
            await page.screenshot({path: filepath});

            // Upload to Minio
            const objectName = `screenshots/${filename}`;
            await this.minioService.uploadFile(filepath, objectName);

            // Get public URL for frontend
            const url = this.minioService.getPublicUrl(objectName);

            // Add to step result
            const screenshot: Screenshot = {
                id: screenshotId,
                stepId,
                timestamp,
                path: objectName,
                url
            };

            stepResult.screenshots.push(screenshot);

            // Clean up local file
            fs.unlinkSync(filepath);

            // Return the screenshot object
            return screenshot;
        } catch (error) {
            logger.error(`Error taking screenshot: ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    }

    /**
     * Adds a log entry to the step result and application logger
     *
     * @method addLog
     * @description Creates a log entry with the current timestamp and adds it to the step result's
     * logs array. The method also logs the message to the application logger using the appropriate
     * log level.
     *
     * This dual logging approach ensures that:
     * 1. The log is preserved in the test result for later review
     * 2. The log is immediately visible in the application logs during test execution
     *
     * Each log entry includes:
     * - A timestamp of when the log was created
     * - A log level (info, warn, error, or debug)
     * - The log message
     *
     * @param {StepResult} stepResult - The step result to add the log entry to
     * @param {'info' | 'warn' | 'error' | 'debug'} level - The severity level of the log
     * @param {string} message - The log message
     * @returns {void}
     * @private
     */
    private addLog(stepResult: StepResult, level: 'info' | 'warn' | 'error' | 'debug', message: string): void {
        const logEntry: LogEntry = {
            timestamp: new Date(),
            level,
            message
        };

        stepResult.logs.push(logEntry);

        // Also log to the application logger
        logger[level](message);
    }

    /**
     * Publishes a step event to notify clients about step execution status
     *
     * @method publishStepEvent
     * @description Creates and publishes an event to notify clients about the status of a test step.
     * This enables real-time monitoring of test execution progress.
     *
     * The event includes:
     * - The event type (STEP)
     * - The run ID to identify which test run this step belongs to
     * - The step ID to identify the specific step
     * - The current status of the step (RUNNING, PASSED, FAILED, etc.)
     * - An optional URL to a screenshot taken during the step
     * - A timestamp of when the event was created
     *
     * The event is published through the emitEvent method, which handles
     * the actual delivery to clients.
     *
     * @param {string} runId - The unique identifier of the test run
     * @param {string} stepId - The unique identifier of the step
     * @param {StepStatus} status - The current status of the step
     * @param {string} [screenshotUrl] - Optional URL to a screenshot taken during the step
     * @returns {Promise<void>} A promise that resolves when the event has been published
     * @private
     */
    private async publishStepEvent(
        runId: string,
        stepId: string,
        status: StepStatus,
        screenshotUrl?: string
    ): Promise<void> {
        const event = {
            type: TestEventType.STEP,
            runId,
            stepId,
            status,
            url: screenshotUrl,
            ts: Date.now(),
        };

        await this.emitEvent(event);
    }

    /**
     * Publishes a run finished event to notify clients about test completion
     *
     * @method publishRunFinished
     * @description Creates and publishes an event to notify clients that a test run has completed.
     * This enables real-time monitoring of test completion and provides links to artifacts
     * like videos and traces for debugging.
     *
     * The event includes:
     * - The event type (RUN_FINISHED)
     * - The run ID to identify which test run has completed
     * - The final status of the test run (PASSED, FAILED, ERROR)
     * - Optional URLs to video recording and trace files
     * - A timestamp of when the event was created
     *
     * In addition to publishing the event through the emitEvent method, this method also
     * sends notifications to Server-Sent Events (SSE) clients if a Redis service is available.
     * It first sends the event data and then sends a '[DONE]' message to signal completion
     * and close the connections.
     *
     * @param {string} runId - The unique identifier of the test run
     * @param {TestStatus} status - The final status of the test run
     * @param {string} [video] - Optional URL to a video recording of the test
     * @param {string} [trace] - Optional URL to a Playwright trace file for debugging
     * @returns {Promise<void>} A promise that resolves when the event has been published
     * @private
     */
    private async publishRunFinished(
        runId: string,
        status: TestStatus,
        video?: string,
        trace?: string
    ): Promise<void> {
        const event = {
            type: TestEventType.RUN_FINISHED,
            runId,
            status,
            video,
            trace,
            ts: Date.now(),
        };

        await this.emitEvent(event);

        // Only for RUN_FINISHED events, notify SSE clients
        if (this.redisService) {
            // Notify SSE clients about the final state
            notifyClients(runId, event);

            // Send the DONE message and close connections
            notifyClients(runId, '[DONE]', true);
        }
    }

    /**
     * Emits an event to the Redis pub/sub system for real-time communication
     *
     * @method emitEvent
     * @description Publishes an event to the Redis pub/sub system to enable real-time
     * communication between the test runner and other components of the system.
     *
     * The method performs the following actions:
     * 1. Checks if the Redis service is available (skips emission if not)
     * 2. Converts the event object to a JSON string
     * 3. Publishes the event to the 'test-events' channel
     * 4. Handles and logs any errors that occur during publishing
     *
     * This method is used internally by publishStepEvent and publishRunFinished to
     * broadcast test execution events to interested subscribers.
     *
     * @param {any} event - The event object to emit (must be JSON-serializable)
     * @returns {Promise<void>} A promise that resolves when the event has been published
     * @private
     */
    private async emitEvent(event: any): Promise<void> {
        if (!this.redisService) {
            logger.debug('Redis service not available, skipping event emission');
            return;
        }

        try {
            // Ensure we're publishing to the correct channel and stringify the event
            const eventJson = JSON.stringify(event);
            logger.info(`Publishing event to Redis: ${event.type}, runId: ${event.runId}, channel: test-events`);
            await this.redisService.publish('test-events', eventJson);
        } catch (error) {
            logger.error(`Error emitting event: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}