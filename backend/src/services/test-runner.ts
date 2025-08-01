import { chromium, Browser, Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { createLogger } from '../utils/logger';
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
import { MinioService } from './minio-service';

// Logger for the test runner
const logger = createLogger('test-runner');

// Directory for temporary screenshots
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || path.join(__dirname, '../../screenshots');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

/**
 * Test runner service that executes test scenarios using Playwright
 */
export class TestRunner {
  private browser: Browser | null = null;
  private minioService: MinioService;
  
  constructor(minioService: MinioService) {
    this.minioService = minioService;
  }
  
  /**
   * Initialize the browser
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
   * Close the browser
   */
  public async closeBrowser(): Promise<void> {
    if (this.browser) {
      logger.info('Closing browser');
      await this.browser.close();
      this.browser = null;
    }
  }
  
  /**
   * Execute a test scenario
   * @param testScenario The test scenario to execute
   * @returns The test result
   */
  public async executeTest(testScenario: TestScenario): Promise<TestResult> {
    logger.info(`Executing test: ${testScenario.id} - ${testScenario.name}`);
    
    // Create initial test result
    const testResult = createTestResult(testScenario);
    testResult.status = TestStatus.RUNNING;
    
    try {
      // Initialize browser
      const browser = await this.initBrowser();
      const context = await browser.newContext();
      const page = await context.newPage();
      
      // Execute each step
      for (let i = 0; i < testScenario.steps.length; i++) {
        const step = testScenario.steps[i];
        const stepResult = testResult.stepResults[i];
        
        // Update step status
        stepResult.status = StepStatus.RUNNING;
        stepResult.startTime = new Date();
        
        try {
          // Execute the step
          await this.executeStep(page, step, stepResult);
          
          // Mark step as passed
          stepResult.status = StepStatus.PASSED;
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
          await this.takeScreenshot(page, step.id, stepResult, 'error');
          
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
      
      // Close context
      await context.close();
      
      // If test wasn't marked as failed, mark it as passed
      if (testResult.status === TestStatus.RUNNING) {
        testResult.status = TestStatus.PASSED;
      }
    } catch (error) {
      // Handle unexpected errors
      logger.error(`Error executing test: ${error instanceof Error ? error.message : String(error)}`);
      testResult.status = TestStatus.ERROR;
    } finally {
      // Update test end time
      testResult.endTime = new Date();
      
      // Update test summary
      updateTestResultSummary(testResult);
    }
    
    return testResult;
  }
  
  /**
   * Execute a single test step
   * @param page The Playwright page
   * @param step The test step to execute
   * @param stepResult The step result to update
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
   * Execute a navigate step
   */
  private async executeNavigateStep(page: Page, step: NavigateStep, stepResult: StepResult): Promise<void> {
    this.addLog(stepResult, 'info', `Navigating to: ${step.url}`);
    await page.goto(step.url);
    this.addLog(stepResult, 'info', `Navigation complete`);
  }
  
  /**
   * Execute an input step
   */
  private async executeInputStep(page: Page, step: InputStep, stepResult: StepResult): Promise<void> {
    this.addLog(stepResult, 'info', `Entering text into selector: ${step.selector}`);
    await page.fill(step.selector, step.text);
    this.addLog(stepResult, 'info', `Text entered`);
  }
  
  /**
   * Execute a click step
   */
  private async executeClickStep(page: Page, step: ClickStep, stepResult: StepResult): Promise<void> {
    this.addLog(stepResult, 'info', `Clicking on selector: ${step.selector}`);
    await page.click(step.selector);
    this.addLog(stepResult, 'info', `Click performed`);
  }
  
  /**
   * Execute an assert text step
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
   * Execute an assert visible step
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
   * Execute a wait step
   */
  private async executeWaitStep(page: Page, step: WaitStep, stepResult: StepResult): Promise<void> {
    this.addLog(stepResult, 'info', `Waiting for ${step.milliseconds}ms`);
    await page.waitForTimeout(step.milliseconds);
    this.addLog(stepResult, 'info', `Wait complete`);
  }
  
  /**
   * Execute an assert URL step
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
   * Execute a screenshot step
   */
  private async executeScreenshotStep(page: Page, step: ScreenshotStep, stepResult: StepResult): Promise<void> {
    this.addLog(stepResult, 'info', `Taking screenshot`);
    await this.takeScreenshot(page, step.id, stepResult, step.name || 'manual');
    this.addLog(stepResult, 'info', `Screenshot taken`);
  }
  
  /**
   * Take a screenshot and add it to the step result
   */
  private async takeScreenshot(
    page: Page, 
    stepId: string, 
    stepResult: StepResult, 
    label: string = 'step'
  ): Promise<void> {
    try {
      const timestamp = new Date();
      const screenshotId = uuidv4();
      const filename = `${stepId}_${label}_${timestamp.getTime()}.png`;
      const filepath = path.join(SCREENSHOT_DIR, filename);
      
      // Take screenshot
      await page.screenshot({ path: filepath });
      
      // Upload to Minio
      const objectName = `screenshots/${filename}`;
      await this.minioService.uploadFile(filepath, objectName);
      
      // Get URL for frontend
      //const url = await this.minioService.getPresignedUrl(objectName);
      // Get public URL for frontend (instead of presigned URL)
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
    } catch (error) {
      logger.error(`Error taking screenshot: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Add a log entry to the step result
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
}