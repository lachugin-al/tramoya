/**
 * Enum representing the types of events that can occur during test execution.
 * These events are used to track and report the progress and results of test runs.
 * 
 * @enum {string}
 * @readonly
 * @property {string} STEP_START - Event emitted when a test step begins execution
 * @property {string} FRAME - Event emitted when a new screenshot frame is captured
 * @property {string} STEP_END - Event emitted when a test step completes execution
 * @property {string} RUN_FINISHED - Event emitted when an entire test run completes
 * @property {string} STEP - General event related to a test step (used for miscellaneous step events)
 */
export enum TestEventType {
  STEP_START = 'step-start',
  FRAME = 'frame',
  STEP_END = 'step-end',
  RUN_FINISHED = 'run-finished',
  STEP = 'step'
}

/**
 * Base interface that defines the common properties shared by all test event types.
 * This interface serves as the foundation for more specific event interfaces.
 * 
 * @interface TestEvent
 * @property {TestEventType} type - The type of event, which determines how the event is processed
 * @property {string} runId - Unique identifier for the test run that generated this event
 * @property {number} ts - Timestamp when the event occurred (milliseconds since epoch)
 */
export interface TestEvent {
  type: TestEventType;
  runId: string;
  ts: number;
}

/**
 * Interface representing an event that is emitted when a test step begins execution.
 * This event marks the beginning of a step's lifecycle and contains information about the step.
 * 
 * @interface StepStartEvent
 * @extends {TestEvent}
 * @property {TestEventType.STEP_START} type - The event type, always STEP_START for this interface
 * @property {string} stepId - Unique identifier for the step that is starting
 * @property {number} index - The position of this step in the sequence of steps (0-based index)
 * @property {string} name - Human-readable name or description of the step
 */
export interface StepStartEvent extends TestEvent {
  type: TestEventType.STEP_START;
  stepId: string;
  index: number;
  name: string;
}

/**
 * Interface representing an event that is emitted when a new screenshot frame is captured.
 * This event provides information about a screenshot taken during test execution,
 * which can be used for visual verification and debugging.
 * 
 * @interface FrameEvent
 * @extends {TestEvent}
 * @property {TestEventType.FRAME} type - The event type, always FRAME for this interface
 * @property {string} stepId - Identifier for the step during which the frame was captured
 * @property {string} url - URL where the frame image can be accessed (typically a presigned URL)
 * @property {string} [path] - Optional file system path where the frame image is stored
 */
export interface FrameEvent extends TestEvent {
  type: TestEventType.FRAME;
  stepId: string;
  url: string;
  path?: string;
}

/**
 * Interface representing an event that is emitted when a test step completes execution.
 * This event marks the end of a step's lifecycle and contains the final status of the step.
 * 
 * @interface StepEndEvent
 * @extends {TestEvent}
 * @property {TestEventType.STEP_END} type - The event type, always STEP_END for this interface
 * @property {string} stepId - Identifier for the step that has completed
 * @property {string} status - The final status of the step (e.g., 'passed', 'failed', 'error')
 *                            This corresponds to values from the StepStatus enum in test-result.ts
 */
export interface StepEndEvent extends TestEvent {
  type: TestEventType.STEP_END;
  stepId: string;
  status: string;
}

/**
 * Interface representing an event that is emitted when an entire test run completes.
 * This event marks the end of a test run and contains the final status and artifacts.
 * 
 * @interface RunFinishedEvent
 * @extends {TestEvent}
 * @property {TestEventType.RUN_FINISHED} type - The event type, always RUN_FINISHED for this interface
 * @property {string} status - The final status of the test run (e.g., 'passed', 'failed', 'error')
 *                            This corresponds to values from the TestStatus enum in test-result.ts
 * @property {string} [video] - Optional URL to a video recording of the entire test run
 * @property {string} [trace] - Optional URL to a trace file containing detailed execution data
 */
export interface RunFinishedEvent extends TestEvent {
  type: TestEventType.RUN_FINISHED;
  status: string;
  video?: string;
  trace?: string;
}

/**
 * Union type representing all possible test event types.
 * This type is used when handling events in a generic way, allowing for type discrimination
 * based on the 'type' property.
 * 
 * @typedef {(
 *   StepStartEvent |
 *   FrameEvent |
 *   StepEndEvent |
 *   RunFinishedEvent
 * )} TestEventUnion
 * 
 * @example
 * // Using type discrimination to handle different event types
 * function handleTestEvent(event: TestEventUnion) {
 *   switch (event.type) {
 *     case TestEventType.STEP_START:
 *       console.log(`Step ${event.name} started`);
 *       break;
 *     case TestEventType.STEP_END:
 *       console.log(`Step ${event.stepId} ended with status ${event.status}`);
 *       break;
 *     // Handle other event types...
 *   }
 * }
 */
export type TestEventUnion = StepStartEvent | FrameEvent | StepEndEvent | RunFinishedEvent;

/**
 * Creates a new StepStartEvent with the specified parameters.
 * This function is used to generate events when a test step begins execution.
 * 
 * @function createStepStartEvent
 * @param {string} runId - Unique identifier for the test run
 * @param {string} stepId - Unique identifier for the step that is starting
 * @param {number} index - The position of this step in the sequence of steps (0-based index)
 * @param {string} name - Human-readable name or description of the step
 * @returns {StepStartEvent} A new StepStartEvent object with the specified properties and current timestamp
 * 
 * @example
 * // Create an event for the first step in a test run
 * const event = createStepStartEvent('run-123', 'step-1', 0, 'Navigate to homepage');
 * emitEvent(event); // Send the event to listeners
 */
export function createStepStartEvent(
  runId: string,
  stepId: string,
  index: number,
  name: string
): StepStartEvent {
  return {
    type: TestEventType.STEP_START,
    runId,
    stepId,
    index,
    name,
    ts: Date.now()
  };
}

/**
 * Creates a new FrameEvent with the specified parameters.
 * This function is used to generate events when a new screenshot frame is captured during test execution.
 * 
 * @function createFrameEvent
 * @param {string} runId - Unique identifier for the test run
 * @param {string} stepId - Identifier for the step during which the frame was captured
 * @param {string} url - URL where the frame image can be accessed (typically a presigned URL)
 * @param {string} [path] - Optional file system path where the frame image is stored
 * @returns {FrameEvent} A new FrameEvent object with the specified properties and current timestamp
 * 
 * @example
 * // Create a frame event with a URL and path
 * const event = createFrameEvent(
 *   'run-123',
 *   'step-1',
 *   'https://storage.example.com/screenshots/frame1.png',
 *   '/tmp/screenshots/frame1.png'
 * );
 */
export function createFrameEvent(
  runId: string,
  stepId: string,
  url: string,
  path?: string
): FrameEvent {
  return {
    type: TestEventType.FRAME,
    runId,
    stepId,
    url,
    path,
    ts: Date.now()
  };
}

/**
 * Creates a new StepEndEvent with the specified parameters.
 * This function is used to generate events when a test step completes execution.
 * 
 * @function createStepEndEvent
 * @param {string} runId - Unique identifier for the test run
 * @param {string} stepId - Identifier for the step that has completed
 * @param {string} status - The final status of the step (e.g., 'passed', 'failed', 'error')
 *                         This should be a value from the StepStatus enum in test-result.ts
 * @returns {StepEndEvent} A new StepEndEvent object with the specified properties and current timestamp
 * 
 * @example
 * // Create an event for a step that passed
 * const event = createStepEndEvent('run-123', 'step-1', 'passed');
 * 
 * @example
 * // Create an event for a step that failed
 * import { StepStatus } from './test-result';
 * const event = createStepEndEvent('run-123', 'step-2', StepStatus.FAILED);
 */
export function createStepEndEvent(
  runId: string,
  stepId: string,
  status: string
): StepEndEvent {
  return {
    type: TestEventType.STEP_END,
    runId,
    stepId,
    status,
    ts: Date.now()
  };
}

/**
 * Creates a new RunFinishedEvent with the specified parameters.
 * This function is used to generate events when an entire test run completes execution.
 * 
 * @function createRunFinishedEvent
 * @param {string} runId - Unique identifier for the test run that has completed
 * @param {string} status - The final status of the test run (e.g., 'passed', 'failed', 'error')
 *                         This should be a value from the TestStatus enum in test-result.ts
 * @param {string} [video] - Optional URL to a video recording of the entire test run
 * @param {string} [trace] - Optional URL to a trace file containing detailed execution data
 * @returns {RunFinishedEvent} A new RunFinishedEvent object with the specified properties and current timestamp
 * 
 * @example
 * // Create a basic run finished event
 * const event = createRunFinishedEvent('run-123', 'passed');
 * 
 * @example
 * // Create a run finished event with video and trace artifacts
 * import { TestStatus } from './test-result';
 * const event = createRunFinishedEvent(
 *   'run-123',
 *   TestStatus.PASSED,
 *   'https://storage.example.com/videos/run-123.mp4',
 *   'https://storage.example.com/traces/run-123.json'
 * );
 */
export function createRunFinishedEvent(
  runId: string,
  status: string,
  video?: string,
  trace?: string
): RunFinishedEvent {
  return {
    type: TestEventType.RUN_FINISHED,
    runId,
    status,
    video,
    trace,
    ts: Date.now()
  };
}