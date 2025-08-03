import {useState, useEffect} from 'react';
import {EventSourcePolyfill} from 'event-source-polyfill';
import {TestResult, TestStatus, StepStatus, Screenshot} from '../types';
import {verifyImageUrl} from '../utils/debug';

/**
 * Event data structure received from the Server-Sent Events stream
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
    const [testResult, setTestResult] = useState<TestResult | null>(initialResult || null);

    // Add effect to log testResult changes and ensure required fields are set
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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);

    // Log connected state changes
    useEffect(() => {
        console.log(`SSE connection state changed: connected=${connected}, runId=${runId}`);
    }, [connected, runId]);

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

            // Handle step-start events
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

            // Handle frame events (screenshots)
            eventSource.addEventListener('frame', (event: any) => {
                try {
                    const data = JSON.parse(event.data) as RunStreamEvent;
                    console.log('Received frame event:', data);

                    /* --------------- валидация входных даных ---------------- */
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

                    /* --------------- обновляем state ------------------------ */
                    setTestResult(prevResult => {
                        /* 1. базовый скелет результата, если его ещё нет */
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

                        /* 2. находим/создаём запись шага */
                        const updatedStepResults = [...baseResult.stepResults];
                        let stepIndex = updatedStepResults.findIndex(
                            s => s.stepId === data.stepId,
                        );

                        if (stepIndex === -1) {
                            updatedStepResults.push({
                                stepId: data.stepId,
                                status: StepStatus.RUNNING,
                                screenshots: [],
                                logs: [],                       // 🔹 обязательное поле
                            });
                            stepIndex = updatedStepResults.length - 1;
                        }

                        /* 3. формируем объект скриншота */
                        const absoluteUrl = data.url!.startsWith('http')
                            ? data.url!
                            : `${window.location.origin}${data.url!}`;

                        const newScreenshot: Screenshot = {
                            id: `screenshot_${Date.now()}`,
                            stepId: data.stepId,
                            timestamp: new Date(data.ts).toISOString(),
                            path: data.url!,                 // 🔹 non-null assertion
                            url: absoluteUrl,
                        };

                        // проверяем, что картинка действительно отдается
                        verifyImageUrl('FrameEvent', absoluteUrl, {
                            stepId: data.stepId,
                            runId: data.runId,
                            eventType: 'frame',
                        });

                        /* 4. кладём скриншот в шаг */
                        updatedStepResults[stepIndex] = {
                            ...updatedStepResults[stepIndex],
                            screenshots: [
                                ...updatedStepResults[stepIndex].screenshots,
                                newScreenshot,
                            ],
                        };

                        /* 5. формируем новый state */
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

            // Handle step-end events
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

            // Handle run-finished events
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

            // Handle test-result events
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

            // Handle connected events
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

            // Handle step events
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

            // Handle generic message events for new event types
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

    return {
        testResult,
        loading,
        error,
        connected,
    };
};

export default useRunStream;