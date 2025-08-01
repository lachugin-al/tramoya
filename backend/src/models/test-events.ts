/**
 * Types of test events
 */
export enum TestEventType {
  STEP_START = 'step-start',
  FRAME = 'frame',
  STEP_END = 'step-end',
  RUN_FINISHED = 'run-finished',
  STEP = 'step'
}

/**
 * Base interface for all test events
 */
export interface TestEvent {
  type: TestEventType;
  runId: string;
  ts: number;
}

/**
 * Event emitted when a test step starts
 */
export interface StepStartEvent extends TestEvent {
  type: TestEventType.STEP_START;
  stepId: string;
  index: number;
  name: string;
}

/**
 * Event emitted when a new frame (screenshot) is available
 */
export interface FrameEvent extends TestEvent {
  type: TestEventType.FRAME;
  stepId: string;
  url: string;
  path?: string;
}

/**
 * Event emitted when a test step ends
 */
export interface StepEndEvent extends TestEvent {
  type: TestEventType.STEP_END;
  stepId: string;
  status: string;
}

/**
 * Event emitted when a test run is finished
 */
export interface RunFinishedEvent extends TestEvent {
  type: TestEventType.RUN_FINISHED;
  status: string;
  video?: string;
  trace?: string;
}

/**
 * Union type for all test events
 */
export type TestEventUnion = StepStartEvent | FrameEvent | StepEndEvent | RunFinishedEvent;

/**
 * Create a step start event
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
 * Create a frame event
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
 * Create a step end event
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
 * Create a run finished event
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