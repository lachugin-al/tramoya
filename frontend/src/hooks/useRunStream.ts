import {useState, useEffect} from 'react';
import {EventSourcePolyfill} from 'event-source-polyfill';
import {TestResult, TestStatus, StepStatus, Screenshot} from '../types';
import {verifyImageUrl} from '../utils/debug';

/**
 * Event data structure received from the Server-Sent Events stream.
 * This interface defines the shape of events coming from the backend test runner.
 * 
 * @interface RunStreamEvent
 * @property {string} type - The type of event (e.g., 'step-start', 'frame', 'step-end', 'run-finished')
 * @property {string} runId - The unique identifier for the test run
 * @property {string} stepId - The identifier for the test step this event relates to
 * @property {string} [url] - Optional URL to a resource (typically a screenshot)
 * @property {string} [status] - Optional status update for a step or run
 * @property {string} [video] - Optional URL to a video recording of the test run
 * @property {string} [trace] - Optional URL to a trace file for debugging
 * @property {number} ts - Timestamp of when the event occurred (in milliseconds since epoch)
 */
interface RunStreamEvent {
    type: string;
    runId: string;
    stepId: string;
    url?: string;
    status?: string;
    video?: string;
    trace?: string;
    ts: number;
}

/**
 * Custom React hook for subscribing to and processing test run events via Server-Sent Events (SSE).
 * 
 * This hook establishes a connection to the server's event stream for a specific test run,
 * processes incoming events (screenshots, step status updates, etc.), and maintains the current
 * state of the test run in real-time.
 * 
 * The hook handles various event types including:
 * - step-start: When a test step begins execution
 * - frame: When a new screenshot is captured
 * - step-end: When a test step completes
 * - run-finished: When the entire test run completes
 * - test-result: When a complete test result is available
 * - connected: When the SSE connection is established
 * - step: When a step status changes
 * 
 * @param {string | null} runId - The unique identifier for the test run to subscribe to, or null if no subscription is needed
 * @param {TestResult | null} [initialResult] - Optional initial test result state to use
 * @param {string | null} [testId] - Optional test identifier, used when creating a new test result if none exists
 * 
 * @returns {Object} An object containing:
 *   - testResult: The current state of the test result, updated in real-time as events are received
 *   - loading: Boolean indicating if the connection is being established
 *   - error: Error message if connection failed, or null if no error
 *   - connected: Boolean indicating if the SSE connection is currently active
 * 
 * @example
 * // Basic usage in a component
 * const { testResult, loading, error, connected } = useRunStream('run-123');
 * 
 * // With initial result
 * const { testResult } = useRunStream('run-123', existingResult);
 * 
 * @example
 * // Handling the different states
 * if (loading) {
 *   return <div>Connecting to test run stream...</div>;
 * }
 * 
 * if (error) {
 *   return <div>Error: {error}</div>;
 * }
 * 
 * if (!connected) {
 *   return <div>Disconnected from test run stream</div>;
 * }
 * 
 * return <TestResultView result={testResult} />;
 */
export const useRunStream = (
    runId: string | null,
    initialResult?: TestResult | null,
    testId?: string | null
) => {
    /**
     * State variable that holds the current test result data.
     * This is updated as events are received from the server.
     */
    const [testResult, setTestResult] = useState<TestResult | null>(initialResult || null);

    /**
     * Effect hook that ensures the test result has all required fields and logs changes.
     * This effect runs whenever the testResult state changes and performs validation and cleanup:
     * - Adds missing endTime for completed tests
     * - Ensures videoUrl and traceUrl are never undefined
     * - Generates summary data if missing
     */
    useEffect(() => {
        if (testResult) {
            let needsUpdate = false;
            let updatedFields: Record<string, any> = {};
            
            // Check if test has a final status but no endTime
            if ((testResult.status === TestStatus.PASSED || 
                 testResult.status === TestStatus.FAILED || 
                 testResult.status === TestStatus.ERROR) && 
                !testResult.endTime) {
                
                updatedFields.endTime = new Date().toISOString();
                needsUpdate = true;
                console.log('Adding missing endTime to completed test');
            }
            
            // Check if videoUrl is undefined or null and set it to empty string
            if (testResult.videoUrl === undefined || testResult.videoUrl === null) {
                updatedFields.videoUrl = '';
                needsUpdate = true;
                console.log('Setting undefined videoUrl to empty string');
            }
            
            // Check if traceUrl is undefined or null and set it to empty string
            if (testResult.traceUrl === undefined || testResult.traceUrl === null) {
                updatedFields.traceUrl = '';
                needsUpdate = true;
                console.log('Setting undefined traceUrl to empty string');
            }
            
            // Check if summary is missing and generate it
            if (!testResult.summary) {
                const stepResults = testResult.stepResults || [];
                const totalSteps = stepResults.length;
                const passedSteps = stepResults.filter(s => s.status === StepStatus.PASSED).length;
                const failedSteps = stepResults.filter(s => s.status === StepStatus.FAILED).length;
                const skippedSteps = stepResults.filter(s => s.status === StepStatus.SKIPPED).length;
                const errorSteps = stepResults.filter(s => s.status === StepStatus.ERROR).length;
                
                // Calculate duration if possible
                let duration = 0;
                if (testResult.endTime && testResult.startTime) {
                    duration = new Date(testResult.endTime).getTime() - new Date(testResult.startTime).getTime();
                }
                
                updatedFields.summary = {
                    totalSteps,
                    passedSteps,
                    failedSteps,
                    skippedSteps,
                    errorSteps,
                    duration
                };
                
                needsUpdate = true;
                console.log('Adding missing summary to test result');
            }
            
            // Update the test result if needed
            if (needsUpdate) {
                setTestResult(prevResult => {
                    if (!prevResult) return prevResult;
                    
                    return {
                        ...prevResult,
                        ...updatedFields
                    };
                });
            }
            
            // Enhanced logging to verify our fixes
            console.log('TestResult state updated:', {
                id: testResult.id,
                testId: testResult.testId || '',  // Verify testId is populated, fallback to empty string
                status: testResult.status,
                startTime: testResult.startTime,
                endTime: testResult.endTime || 'not completed',  // Provide a fallback for endTime
                stepResults: testResult.stepResults.length,
                summary: testResult.summary || 'not available',  // Provide a fallback for summary
                videoUrl: testResult.videoUrl || '',  // Provide a fallback for videoUrl
                traceUrl: testResult.traceUrl || ''   // Provide a fallback for traceUrl
            });
            
            console.log('Current steps:', testResult.stepResults.map(step =>
                `${step.stepId}: ${step.status} (${step.screenshots.length} screenshots)`).join(', '));
        }
    }, [testResult]);

    /**
     * State variable that indicates whether the SSE connection is being established.
     * True during the connection process, false once connected or if an error occurs.
     */
    const [loading, setLoading] = useState(false);

    /**
     * State variable that holds any error message if the SSE connection fails.
     * Null if there is no error.
     */
    const [error, setError] = useState<string | null>(null);

    /**
     * State variable that indicates whether the SSE connection is currently active.
     * True when connected, false when disconnected or not yet connected.
     */
    const [connected, setConnected] = useState(false);

    /**
     * Effect hook that logs changes to the connection state.
     * This helps with debugging connection issues.
     */
    useEffect(() => {
        console.log(`SSE connection state changed: connected=${connected}, runId=${runId}`);
    }, [connected, runId]);

    /**
     * Main effect hook that establishes and manages the SSE connection.
     * This effect:
     * 1. Creates an EventSource connection to the server
     * 2. Sets up event listeners for different event types
     * 3. Processes incoming events and updates the test result state
     * 4. Handles connection errors and cleanup
     */
    useEffect(() => {
        if (!runId) {
            console.log('No runId provided, skipping SSE connection');
            return;
        }

        console.log(`Setting up SSE connection for runId: ${runId}`);
        setLoading(true);
        let eventSource: EventSourcePolyfill | null = null;

        try {
            // Create EventSource connection
            console.log(`Creating new EventSourcePolyfill for runId: ${runId}`);
            eventSource = new EventSourcePolyfill(`/api/v1/stream/${runId}`, {
                withCredentials: false,
            });

            // Handle connection open
            eventSource.onopen = () => {
                console.log(`SSE connection opened successfully for run: ${runId}`);
                setConnected(true);
                setLoading(false);
                setError(null);
            };

            // Handle connection error
            eventSource.onerror = (err) => {
                console.error('SSE connection error:', err);
                setError('Failed to connect to event stream');
                setLoading(false);
                setConnected(false);

                // Close and cleanup on error
                if (eventSource) {
                    console.log(`Closing SSE connection due to error for run: ${runId}`);
                    eventSource.close();
                }
            };

            /**
             * Event handler for 'step-start' events.
             * 
             * This handler processes events that indicate a test step has started execution.
             * It updates the corresponding step's status to RUNNING and ensures the overall
             * test status is set to RUNNING.
             * 
             * @param {any} event - The event object from the EventSource
             */
            eventSource.addEventListener('step-start', (event: any) => {
                try {
                    const data = JSON.parse(event.data) as RunStreamEvent;
                    console.log('Received step-start event:', data);

                    // Check if the event's runId matches our expected runId
                    if (data.runId !== runId) {
                        console.log(`Ignoring step-start event for unrelated runId: ${data.runId} (we want ${runId})`);
                        return;
                    }

                    console.log(`Processing step-start event for runId: ${data.runId}`);

                    setTestResult((prevResult) => {
                        if (!prevResult) {
                            return prevResult;
                        }

                        // Find the step result by stepId
                        const updatedStepResults = [...prevResult.stepResults];
                        const stepIndex = updatedStepResults.findIndex(
                            (step) => step.stepId === data.stepId
                        );

                        if (stepIndex !== -1) {
                            // Update the step status to running
                            updatedStepResults[stepIndex] = {
                                ...updatedStepResults[stepIndex],
                                status: StepStatus.RUNNING,
                            };
                        }

                        return {
                            ...prevResult,
                            status: TestStatus.RUNNING,
                            stepResults: updatedStepResults,
                        };
                    });
                } catch (err) {
                    console.error('Error processing step-start event:', err);
                }
            });

            /**
             * Event handler for 'frame' events.
             * 
             * This handler processes events that contain screenshot data from the test execution.
             * It creates or updates the test result with the new screenshot, ensuring all required
             * fields are properly set. If this is the first event received, it will initialize
             * the test result structure.
             * 
             * @param {any} event - The event object from the EventSource
             */
            eventSource.addEventListener('frame', (event: any) => {
                try {
                    const data = JSON.parse(event.data) as RunStreamEvent;
                    console.log('Received frame event:', data);

                    /* --------------- Input validation ---------------- */
                    if (data.runId !== runId) {
                        console.log(
                            `Ignoring frame event for unrelated runId: ${data.runId} (we want ${runId})`,
                        );
                        return;
                    }
                    if (!data.url) {
                        console.warn('Frame event missing URL');
                        return;
                    }
                    console.log(`Processing frame event for runId: ${data.runId}`);

                    /* --------------- Update state ------------------------ */
                    setTestResult(prevResult => {
                        /* 1. Create base result skeleton if it doesn't exist yet */
                        const baseResult: TestResult = prevResult ?? {
                            id: data.runId,
                            testId: testId || data.runId,    // Use provided testId or fallback to runId
                            status: TestStatus.RUNNING,
                            startTime: new Date(data.ts).toISOString(),
                            endTime: undefined,
                            stepResults: [],
                            videoUrl: '',  // Initialize with empty string instead of undefined
                            traceUrl: '',  // Initialize with empty string instead of undefined
                        };

                        /* 2. Find or create step record */
                        const updatedStepResults = [...baseResult.stepResults];
                        let stepIndex = updatedStepResults.findIndex(
                            s => s.stepId === data.stepId,
                        );

                        if (stepIndex === -1) {
                            updatedStepResults.push({
                                stepId: data.stepId,
                                status: StepStatus.RUNNING,
                                screenshots: [],
                                logs: [],                       // Required field
                            });
                            stepIndex = updatedStepResults.length - 1;
                        }

                        /* 3. Create screenshot object */
                        const absoluteUrl = data.url!.startsWith('http')
                            ? data.url!
                            : `${window.location.origin}${data.url!}`;

                        const newScreenshot: Screenshot = {
                            id: `screenshot_${Date.now()}`,
                            stepId: data.stepId,
                            timestamp: new Date(data.ts).toISOString(),
                            path: data.url!,                 // Non-null assertion
                            url: absoluteUrl,
                        };

                        // Verify the image URL is accessible
                        verifyImageUrl('FrameEvent', absoluteUrl, {
                            stepId: data.stepId,
                            runId: data.runId,
                            eventType: 'frame',
                        });

                        /* 4. Add screenshot to step */
                        updatedStepResults[stepIndex] = {
                            ...updatedStepResults[stepIndex],
                            screenshots: [
                                ...updatedStepResults[stepIndex].screenshots,
                                newScreenshot,
                            ],
                        };

                        /* 5. Create new state */
                        const result: TestResult = {
                            ...baseResult,
                            stepResults: updatedStepResults,
                            // Ensure videoUrl and traceUrl are never undefined
                            videoUrl: baseResult.videoUrl || '',
                            traceUrl: baseResult.traceUrl || ''
                        };

                        console.log('Updated test result after frame event:', {
                            id: result.id,
                            testId: result.testId || '',
                            status: result.status,
                            startTime: result.startTime,
                            endTime: result.endTime || 'not completed',  // Add fallback for running tests
                            stepResults: result.stepResults.length,
                            videoUrl: result.videoUrl || '',
                            traceUrl: result.traceUrl || ''
                        });
                        return result;
                    });
                } catch (err) {
                    console.error('Error processing frame event:', err);
                }
            });

            /**
             * Event handler for 'step-end' events.
             * 
             * This handler processes events that indicate a test step has completed execution.
             * It updates the corresponding step's status to the final status provided in the event
             * (e.g., PASSED, FAILED, SKIPPED, ERROR).
             * 
             * @param {any} event - The event object from the EventSource
             */
            eventSource.addEventListener('step-end', (event: any) => {
                try {
                    const data = JSON.parse(event.data) as RunStreamEvent;
                    console.log('Received step-end event:', data);

                    // Check if the event's runId matches our expected runId
                    if (data.runId !== runId) {
                        console.log(`Ignoring step-end event for unrelated runId: ${data.runId} (we want ${runId})`);
                        return;
                    }

                    console.log(`Processing step-end event for runId: ${data.runId}`);

                    setTestResult((prevResult) => {
                        if (!prevResult) {
                            return prevResult;
                        }

                        // Find the step result by stepId
                        const updatedStepResults = [...prevResult.stepResults];
                        const stepIndex = updatedStepResults.findIndex(
                            (step) => step.stepId === data.stepId
                        );

                        if (stepIndex !== -1 && data.status) {
                            // Update the step status
                            updatedStepResults[stepIndex] = {
                                ...updatedStepResults[stepIndex],
                                status: data.status as StepStatus,
                            };
                        }

                        return {
                            ...prevResult,
                            stepResults: updatedStepResults,
                        };
                    });
                } catch (err) {
                    console.error('Error processing step-end event:', err);
                }
            });

            /**
             * Event handler for 'run-finished' events.
             * 
             * This handler processes events that indicate the entire test run has completed.
             * It updates the test result with the final status, video URL, trace URL, and end time.
             * It also handles duplicate run-finished events by ignoring them if the test already
             * has a final status.
             * 
             * @param {any} event - The event object from the EventSource
             */
            eventSource.addEventListener('run-finished', (event: any) => {
                try {
                    const data = JSON.parse(event.data) as RunStreamEvent;
                    console.log('Received run-finished event:', data);

                    // Check if the event's runId matches our expected runId
                    if (data.runId !== runId) {
                        console.log(`Ignoring run-finished event for unrelated runId: ${data.runId} (we want ${runId})`);
                        return;
                    }

                    console.log(`Processing run-finished event for runId: ${data.runId}`);

                    setTestResult((prevResult) => {
                        if (!prevResult) {
                            return prevResult;
                        }

                        // If the test result already has a final status (not RUNNING or PENDING),
                        // and we receive another run-finished event, log it but don't update the state
                        if (prevResult.status !== TestStatus.RUNNING && prevResult.status !== TestStatus.PENDING) {
                            console.log(`Ignoring duplicate run-finished event. Current status: ${prevResult.status}`);
                            return prevResult;
                        }

                        return {
                            ...prevResult,
                            status: data.status as TestStatus,
                            videoUrl: data.video,
                            traceUrl: data.trace,
                            endTime: new Date(data.ts).toISOString(),
                        };
                    });
                } catch (err) {
                    console.error('Error processing run-finished event:', err);
                }
            });

            /**
             * Event handler for 'test-result' events.
             * 
             * This handler processes events that contain a complete test result object.
             * Unlike other events that update specific parts of the test result, this event
             * replaces the entire test result state with the provided data.
             * 
             * Note: test-result events use 'id' instead of 'runId' for identification.
             * 
             * @param {any} event - The event object from the EventSource
             */
            eventSource.addEventListener('test-result', (event: any) => {
                try {
                    console.log('Received test-result event:', event.data);
                    const data = JSON.parse(event.data);

                    // For test-result events, we need to check data.id against runId
                    // This is because test-result events use 'id' instead of 'runId'
                    if (data.runId !== runId && data.id !== runId) {
                        console.log(`Ignoring test-result event for unrelated runId: ${data.id || data.runId} (we want ${runId})`);
                        return;
                    }

                    console.log(`Processing test-result event for runId: ${data.runId || data.id}`);
                    setTestResult(data);
                } catch (err) {
                    console.error('Error processing test-result event:', err);
                }
            });

            /**
             * Event handler for 'connected' events.
             * 
             * This handler processes events that indicate the SSE connection has been established.
             * It validates that the event is for the correct runId but doesn't update any state
             * as the connection state is managed by the onopen handler.
             * 
             * @param {any} event - The event object from the EventSource
             */
            eventSource.addEventListener('connected', (event: any) => {
                try {
                    console.log('Received connected event:', event.data);
                    const data = JSON.parse(event.data);

                    // Check if the event's runId matches our expected runId
                    if (data.runId !== runId) {
                        console.log(`Ignoring connected event for unrelated runId: ${data.runId} (we want ${runId})`);
                        return;
                    }

                    console.log(`Processing connected event for runId: ${data.runId}`);
                } catch (err) {
                    console.error('Error processing connected event:', err);
                }
            });

            /**
             * Event handler for 'step' events.
             * 
             * This handler processes events that update a step's status and potentially add a screenshot.
             * It's similar to step-end but can be used for any status update during the step's lifecycle.
             * If the event includes a URL, it will add a new screenshot to the step's collection.
             * 
             * @param {any} event - The event object from the EventSource
             */
            eventSource.addEventListener('step', (event: any) => {
                try {
                    const data = JSON.parse(event.data) as RunStreamEvent;
                    console.log('Received step event:', data);

                    // Check if the event's runId matches our expected runId
                    if (data.runId !== runId) {
                        console.log(`Ignoring step event for unrelated runId: ${data.runId} (we want ${runId})`);
                        return;
                    }

                    console.log(`Processing step event for runId: ${data.runId}`);

                    setTestResult((prevResult) => {
                        if (!prevResult) {
                            return prevResult;
                        }

                        // Find the step result by stepId
                        const updatedStepResults = [...prevResult.stepResults];
                        const stepIndex = updatedStepResults.findIndex(
                            (step) => step.stepId === data.stepId
                        );

                        if (stepIndex !== -1 && data.status) {
                            console.log(`Updating step ${data.stepId} with status ${data.status} and screenshot URL ${data.url || 'none'}`);
                            // Update the step status
                            updatedStepResults[stepIndex] = {
                                ...updatedStepResults[stepIndex],
                                status: data.status as StepStatus,
                                screenshots: data.url
                                    ? (() => {
                                        // Verify the image URL is accessible
                                        if (data.url) {
                                            verifyImageUrl('StepEvent', data.url, {
                                                stepId: data.stepId,
                                                runId: data.runId,
                                                eventType: 'step',
                                                status: data.status
                                            });
                                        }

                                        return [...updatedStepResults[stepIndex].screenshots, {
                                            id: `screenshot_${Date.now()}`,
                                            stepId: data.stepId,
                                            timestamp: new Date(data.ts).toISOString(),
                                            path: data.url,
                                            url: data.url?.startsWith('http') ? data.url : `${window.location.origin}${data.url}`
                                        }];
                                    })()
                                    : updatedStepResults[stepIndex].screenshots
                            };
                        }

                        return {
                            ...prevResult,
                            stepResults: updatedStepResults,
                        };
                    });
                } catch (err) {
                    console.error('Error processing step event:', err);
                }
            });

            /**
             * Generic message event handler.
             * 
             * This handler processes any events that don't have a specific event listener.
             * It handles:
             * 1. Special [DONE] messages that indicate the stream should be closed
             * 2. Generic 'step' events (both lowercase and uppercase for backward compatibility)
             * 3. Generic 'run-finished' events (both lowercase and uppercase for backward compatibility)
             * 
             * This provides a fallback mechanism for handling events that might be sent with
             * different formats or types than expected.
             * 
             * @param {MessageEvent} e - The message event from the EventSource
             */
            eventSource.onmessage = (e) => {
                try {
                    // Check for special [DONE] message
                    if (e.data === '[DONE]') {
                        console.log(`Received [DONE] message for run: ${runId}, closing connection`);
                        eventSource?.close();
                        setConnected(false);
                        return;
                    }

                    const evt = JSON.parse(e.data) as RunStreamEvent;
                    console.log('Received generic message event:', evt);

                    // Check if the event's runId matches our expected runId
                    if (evt.runId !== runId) {
                        console.log(`Ignoring event for unrelated runId: ${evt.runId} (we want ${runId})`);
                        return;
                    }

                    console.log(`Processing event for runId: ${evt.runId}`);

                    switch (evt.type) {
                        case 'step':
                        case 'STEP': // Handle both lowercase and uppercase for backward compatibility
                            console.log('Processing step event:', evt);
                            setTestResult(r => {
                                if (!r) return r;

                                // Find the step result by stepId
                                const updatedStepResults = [...r.stepResults];
                                const stepIndex = updatedStepResults.findIndex(
                                    (step) => step.stepId === evt.stepId
                                );

                                if (stepIndex !== -1 && evt.status) {
                                    console.log(`Updating step ${evt.stepId} with status ${evt.status} and screenshot URL ${evt.url || 'none'}`);
                                    // Update the step status
                                    updatedStepResults[stepIndex] = {
                                        ...updatedStepResults[stepIndex],
                                        status: evt.status as StepStatus,
                                        screenshots: evt.url
                                            ? (() => {
                                                // Verify the image URL is accessible
                                                if (evt.url) {
                                                    verifyImageUrl('GenericMessageEvent', evt.url, {
                                                        stepId: evt.stepId,
                                                        runId: evt.runId,
                                                        eventType: evt.type,
                                                        status: evt.status
                                                    });
                                                }

                                                return [...updatedStepResults[stepIndex].screenshots, {
                                                    id: `screenshot_${Date.now()}`,
                                                    stepId: evt.stepId,
                                                    timestamp: new Date(evt.ts).toISOString(),
                                                    path: evt.url,
                                                    url: evt.url?.startsWith('http') ? evt.url : `${window.location.origin}${evt.url}`
                                                }];
                                            })()
                                            : updatedStepResults[stepIndex].screenshots
                                    };
                                }

                                return {
                                    ...r,
                                    stepResults: updatedStepResults,
                                };
                            });
                            break;

                        case 'run-finished':
                        case 'RUN_FINISHED': // Handle both lowercase and uppercase for backward compatibility
                            console.log('Processing run-finished event:', evt);
                            setTestResult(r => {
                                if (!r) return r;

                                return {
                                    ...r,
                                    status: evt.status as TestStatus,
                                    videoUrl: evt.video,
                                    traceUrl: evt.trace,
                                    endTime: new Date(evt.ts).toISOString(),
                                };
                            });
                            break;
                    }
                } catch (err) {
                    console.error('Error processing message event:', err);
                }
            };
            
            // Log EventSource instance after all handlers are assigned
            console.log('EventSource instance created with all handlers:', {
                instance: 'EventSourcePolyfill',
                url: `/api/v1/stream/${runId}`,
                onopen: typeof eventSource.onopen === 'function' ? 'function() {...}' : eventSource.onopen,
                onmessage: typeof eventSource.onmessage === 'function' ? 'function() {...}' : eventSource.onmessage,
                onerror: typeof eventSource.onerror === 'function' ? 'function() {...}' : eventSource.onerror,
                readyState: eventSource.readyState
            });

        } catch (err) {
            console.error('Error setting up SSE connection:', err);
            setError('Failed to set up event stream');
            setLoading(false);
        }

        // Cleanup function
        return () => {
            if (eventSource) {
                console.log(`Cleanup: Closing SSE connection for run: ${runId}`);
                eventSource.close();
                setConnected(false);
                console.log(`Cleanup: SSE connection closed for run: ${runId}, connected state reset`);
            } else {
                console.log(`Cleanup: No active SSE connection to close for run: ${runId}`);
            }
        };
    }, [runId]);

    /**
     * Returns an object containing the current state of the test run stream.
     * 
     * @returns {Object} An object with the following properties:
     *   - testResult: The current state of the test result, updated in real-time as events are received
     *   - loading: Boolean indicating if the connection is being established
     *   - error: Error message if connection failed, or null if no error
     *   - connected: Boolean indicating if the SSE connection is currently active
     */
    return {
        testResult,
        loading,
        error,
        connected,
    };
};

export default useRunStream;