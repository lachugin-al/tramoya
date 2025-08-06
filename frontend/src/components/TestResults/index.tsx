import React, {useState, useEffect} from 'react';
import {useParams, useNavigate, Link} from 'react-router-dom';
import {toast} from 'react-toastify';
import apiService from '../../services/api';
import {TestResult, TestStatus, StepStatus, StepResult, TestScenario} from '../../types';
import TraceViewer from '../TraceViewer/TraceViewer';

/**
 * CSS class mappings for test status badges
 *
 * @constant
 * @type {Record<TestStatus | StepStatus, string>}
 * @description Maps test and step statuses to their corresponding CSS classes for styling
 */
const statusColors = {
    [TestStatus.PENDING]: 'bg-gray-200 text-gray-800',
    [TestStatus.RUNNING]: 'bg-blue-200 text-blue-800',
    [TestStatus.PASSED]: 'bg-green-200 text-green-800',
    [TestStatus.FAILED]: 'bg-red-200 text-red-800',
    [TestStatus.ERROR]: 'bg-yellow-200 text-yellow-800',
    [StepStatus.SKIPPED]: 'bg-purple-200 text-purple-800',
};

/**
 * Emoji icons for test statuses
 *
 * @constant
 * @type {Record<TestStatus | StepStatus, string>}
 * @description Maps test and step statuses to their corresponding emoji icons for visual representation
 */
const statusIcons = {
    [TestStatus.PENDING]: '⏳',
    [TestStatus.RUNNING]: '🔄',
    [TestStatus.PASSED]: '✅',
    [TestStatus.FAILED]: '❌',
    [TestStatus.ERROR]: '⚠️',
    [StepStatus.SKIPPED]: '⏭️',
};

/**
 * Formats a duration in milliseconds to a human-readable string
 *
 * @function formatDuration
 * @param {number} milliseconds - The duration in milliseconds to format
 * @returns {string} A formatted string representation of the duration (e.g., "500ms", "2.500s", "1m 30s")
 *
 * @example
 * formatDuration(500) // "500ms"
 * formatDuration(2500) // "2.500s"
 * formatDuration(90000) // "1m 30s"
 */
const formatDuration = (milliseconds: number) => {
    if (milliseconds < 1000) {
        return `${milliseconds}ms`;
    }

    const seconds = Math.floor(milliseconds / 1000);
    const ms = milliseconds % 1000;

    if (seconds < 60) {
        return `${seconds}.${ms.toString().padStart(3, '0')}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${minutes}m ${secs}s`;
};

/**
 * TestResults Component
 *
 * @component
 * @description Displays detailed results of a test execution, including overall status,
 * summary statistics, and individual step results. The component handles various states
 * including loading, error, and not found states. For running tests, it provides a refresh
 * button to get the latest results.
 *
 * @example
 * ```tsx
 * <TestResults />
 * ```
 */
const TestResults: React.FC = () => {
    /**
     * Test result ID extracted from URL parameters
     */
    const {id} = useParams<{ id: string }>();

    /**
     * Navigation function from React Router
     */
    const navigate = useNavigate();

    /**
     * State containing the test result data
     */
    const [result, setResult] = useState<TestResult | null>(null);

    /**
     * State containing the test scenario data
     */
    const [test, setTest] = useState<TestScenario | null>(null);

    /**
     * State indicating whether data is currently being loaded
     */
    const [loading, setLoading] = useState(true);

    /**
     * State containing error message if data loading fails
     */
    const [error, setError] = useState<string | null>(null);

    /**
     * State for storing the polling interval ID for automatic refreshes
     */
    const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

    /**
     * State tracking the ID of the currently expanded step
     */
    const [activeStep, setActiveStep] = useState<string | null>(null);
    
    /**
     * State for controlling the visibility of the trace viewer
     */
    const [showTraceViewer, setShowTraceViewer] = useState(false);

    /**
     * Effect hook to fetch test result when component mounts
     *
     * @effect
     * @description Fetches the test result data when the component mounts and
     * cleans up any polling intervals when the component unmounts
     * @dependencies [id]
     */
    useEffect(() => {
        if (id) {
            fetchResult(id);
        }

        // Clean up polling interval on unmount
        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
        };
    }, [id]);

    /**
     * Fetches test result data from the API
     *
     * @async
     * @function fetchResult
     * @param {string} resultId - The ID of the test result to fetch
     * @returns {Promise<void>}
     * @description Retrieves the test result and associated test scenario data from the backend API
     */
    const fetchResult = async (resultId: string) => {
        try {
            setLoading(true);
            const data = await apiService.getTestResult(resultId);
            setResult(data);

            // Fetch test details
            if (data.testId) {
                try {
                    const testData = await apiService.getTest(data.testId);
                    setTest(testData);
                } catch (err) {
                    console.error('Error fetching test details:', err);
                }
            }

            // No longer polling for test results
            if (pollingInterval) {
                clearInterval(pollingInterval);
                setPollingInterval(null);
            }

            setError(null);
        } catch (err) {
            console.error('Error fetching test result:', err);
            setError('Failed to load test result. Please try again.');
            toast.error('Failed to load test result');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Toggles the expanded/collapsed state of a step
     *
     * @function toggleStep
     * @param {string} stepId - The ID of the step to toggle
     * @returns {void}
     * @description Expands the step if it's currently collapsed, or collapses it if it's currently expanded
     */
    const toggleStep = (stepId: string) => {
        setActiveStep(activeStep === stepId ? null : stepId);
    };

    // Render loading state
    if (loading && !result) {
        return (
            <div className="text-center py-10">
                <p>Loading test result...</p>
            </div>
        );
    }

    // Render error state
    if (error && !result) {
        return (
            <div className="text-center py-10">
                <div className="alert alert-error">{error}</div>
                <button onClick={() => navigate('/')} className="mt-4">
                    Go Back
                </button>
            </div>
        );
    }

    // Render not found state
    if (!result) {
        return (
            <div className="text-center py-10">
                <h2 className="text-2xl font-bold mb-4">Test Result Not Found</h2>
                <p className="mb-4">The test result you are looking for does not exist.</p>
                <Link to="/" className="button">
                    Go Home
                </Link>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-2xl font-bold">Test Result</h2>
                    {test && (
                        <h3 className="text-xl mt-1">
                            {test.name}
                            {test.description && (
                                <span className="text-gray-500 text-base ml-2">
                  {test.description}
                </span>
                            )}
                        </h3>
                    )}
                </div>
                <div className="flex gap-2">
                    <Link to="/" className="button bg-secondary">
                        Back to Tests
                    </Link>
                    {test && (
                        <Link to={`/edit/${test.id}`} className="button">
                            Edit Test
                        </Link>
                    )}
                </div>
            </div>

            {/* Test summary */}
            <div className="card mb-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center">
            <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mr-2 ${
                    statusColors[result.status]
                }`}
            >
              {statusIcons[result.status]} {result.status.toUpperCase()}
            </span>
                        <span className="text-gray-500">
              Started: {new Date(result.startTime).toLocaleString()}
            </span>
                        {result.endTime && (
                            <span className="text-gray-500 ml-4">
                Ended: {new Date(result.endTime).toLocaleString()}
              </span>
                        )}
                    </div>
                    {result.status === TestStatus.RUNNING && (
                        <div className="animate-pulse text-blue-600">Test is running...</div>
                    )}
                </div>

                {result.summary && (
                    <div className="grid grid-cols-5 gap-4 text-center">
                        <div className="p-3 bg-gray-100 rounded">
                            <div className="text-2xl font-bold">{result.summary.totalSteps}</div>
                            <div className="text-sm text-gray-500">Total Steps</div>
                        </div>
                        <div className="p-3 bg-green-100 rounded">
                            <div className="text-2xl font-bold text-green-700">
                                {result.summary.passedSteps}
                            </div>
                            <div className="text-sm text-green-700">Passed</div>
                        </div>
                        <div className="p-3 bg-red-100 rounded">
                            <div className="text-2xl font-bold text-red-700">
                                {result.summary.failedSteps}
                            </div>
                            <div className="text-sm text-red-700">Failed</div>
                        </div>
                        <div className="p-3 bg-yellow-100 rounded">
                            <div className="text-2xl font-bold text-yellow-700">
                                {result.summary.errorSteps}
                            </div>
                            <div className="text-sm text-yellow-700">Errors</div>
                        </div>
                        <div className="p-3 bg-purple-100 rounded">
                            <div className="text-2xl font-bold text-purple-700">
                                {result.summary.skippedSteps}
                            </div>
                            <div className="text-sm text-purple-700">Skipped</div>
                        </div>
                        {result.summary.duration > 0 && (
                            <div className="col-span-5 mt-2 text-center">
                                <div className="text-lg font-medium">
                                    Total Duration: {formatDuration(result.summary.duration)}
                                </div>
                            </div>
                        )}
                        
                        {/* Trace Viewer Button */}
                        <div className="col-span-5 mt-4 flex justify-center">
                            <button
                                onClick={() => setShowTraceViewer(true)}
                                className="button bg-indigo-600 hover:bg-indigo-700 text-white flex items-center"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                </svg>
                                Open Trace Viewer
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Steps results */}
            <h3 className="text-xl font-bold mb-4">Test Steps</h3>
            <div className="space-y-4">
                {result.stepResults.map((stepResult, index) => (
                    <StepResultItem
                        key={stepResult.stepId}
                        stepResult={stepResult}
                        index={index}
                        test={test}
                        isActive={activeStep === stepResult.stepId}
                        onToggle={() => toggleStep(stepResult.stepId)}
                    />
                ))}
            </div>

            {/* Refresh button for running tests */}
            {(result.status === TestStatus.PENDING || result.status === TestStatus.RUNNING) && (
                <div className="mt-6 text-center">
                    <button
                        onClick={() => id && fetchResult(id)}
                        className="button"
                        disabled={loading}
                    >
                        {loading ? 'Refreshing...' : 'Refresh Results'}
                    </button>
                </div>
            )}
            
            {/* Trace Viewer */}
            {showTraceViewer && (
                <div className="preview-panel-container">
                    <div className="preview-panel-header">
                        <h3 className="text-xl font-bold">Playwright Trace Viewer</h3>
                        <button 
                            onClick={() => setShowTraceViewer(false)}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="preview-panel-content">
                        <TraceViewer traceId={id || ''} />
                    </div>
                </div>
            )}
            
            {/* Preview Panel Styles */}
            <style>{`
                .preview-panel-container {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    height: 600px;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    overflow: hidden;
                    margin-top: 20px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                }
                
                .preview-panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    background: #f3f4f6;
                    border-bottom: 1px solid #e5e7eb;
                }
                
                .preview-panel-content {
                    flex: 1;
                    overflow: hidden;
                    background: white;
                }
            `}</style>
        </div>
    );
};

/**
 * Props for the StepResultItem component
 *
 * @interface StepResultItemProps
 * @property {StepResult} stepResult - The result data for a single test step
 * @property {number} index - The index of the step in the test sequence
 * @property {TestScenario | null} test - The test scenario data, or null if not available
 * @property {boolean} isActive - Whether the step details are currently expanded
 * @property {function} onToggle - Callback function to toggle the expanded/collapsed state
 */
interface StepResultItemProps {
    stepResult: StepResult;
    index: number;
    test: TestScenario | null;
    isActive: boolean;
    onToggle: () => void;
}

/**
 * StepResultItem Component
 *
 * @component
 * @description Renders a single test step result with expandable details.
 * When expanded, shows step details, error information, screenshots, and logs.
 *
 * @param {StepResultItemProps} props - Component props
 * @returns {JSX.Element} The rendered step result item
 */
const StepResultItem: React.FC<StepResultItemProps> = ({
                                                           stepResult,
                                                           index,
                                                           test,
                                                           isActive,
                                                           onToggle,
                                                       }) => {
    // Find step details from test
    const step = test?.steps.find(s => s.id === stepResult.stepId);

    return (
        <div className="card">
            <div
                className="flex justify-between items-center cursor-pointer"
                onClick={onToggle}
            >
                <div className="flex items-center">
          <span className="inline-block w-8 h-8 bg-gray-200 rounded-full text-center leading-8 mr-3">
            {index + 1}
          </span>
                    <span
                        className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium mr-3 ${
                            statusColors[stepResult.status]
                        }`}
                    >
            {statusIcons[stepResult.status]} {stepResult.status.toUpperCase()}
          </span>
                    <span className="font-medium">
            {step ? step.type : 'Unknown Step'}
                        {step?.description && (
                            <span className="text-gray-500 ml-2">{step.description}</span>
                        )}
          </span>
                </div>
                <div className="flex items-center">
                    {stepResult.startTime && stepResult.endTime && (
                        <span className="text-sm text-gray-500 mr-3">
              {formatDuration(
                  new Date(stepResult.endTime).getTime() -
                  new Date(stepResult.startTime).getTime()
              )}
            </span>
                    )}
                    <span className="text-gray-400">{isActive ? '▼' : '▶'}</span>
                </div>
            </div>

            {isActive && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                    {/* Step details */}
                    {step && (
                        <div className="mb-4 p-3 bg-gray-50 rounded">
                            <h4 className="font-bold mb-2">Step Details</h4>
                            <pre className="text-sm whitespace-pre-wrap">
                {JSON.stringify(step, null, 2)}
              </pre>
                        </div>
                    )}

                    {/* Error message */}
                    {stepResult.error && (
                        <div className="mb-4 p-3 bg-red-50 rounded border border-red-200">
                            <h4 className="font-bold text-red-700 mb-2">Error</h4>
                            <div className="text-red-700">{stepResult.error.message}</div>
                            {stepResult.error.stack && (
                                <pre className="mt-2 text-sm text-red-600 whitespace-pre-wrap">
                  {stepResult.error.stack}
                </pre>
                            )}
                        </div>
                    )}

                    {/* Screenshots */}
                    {stepResult.screenshots.length > 0 && (
                        <div className="mb-4">
                            <h4 className="font-bold mb-2">Screenshots</h4>
                            <div className="grid grid-cols-2 gap-4">
                                {stepResult.screenshots.map(screenshot => (
                                    <div key={screenshot.id} className="border rounded overflow-hidden">
                                        <div className="p-2 bg-gray-100 text-sm">
                                            {new Date(screenshot.timestamp).toLocaleString()}
                                        </div>
                                        {screenshot.url ? (
                                            <a
                                                href={screenshot.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <img
                                                    src={screenshot.url}
                                                    alt="Test screenshot"
                                                    className="w-full h-auto"
                                                />
                                            </a>
                                        ) : (
                                            <div className="p-4 text-center text-gray-500">
                                                Screenshot not available
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Logs */}
                    {stepResult.logs.length > 0 && (
                        <div>
                            <h4 className="font-bold mb-2">Logs</h4>
                            <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-sm">
                                {stepResult.logs.map((log, i) => {
                                    // Choose log level color
                                    let logColor = 'text-gray-300';
                                    if (log.level === 'error') logColor = 'text-red-400';
                                    else if (log.level === 'warn') logColor = 'text-yellow-400';
                                    else if (log.level === 'info') logColor = 'text-blue-400';

                                    return (
                                        <div key={i} className={`${logColor}`}>
                      <span className="text-gray-500">
                        [{new Date(log.timestamp).toLocaleTimeString()}]
                      </span>{' '}
                                            <span className="uppercase font-bold">{log.level}</span>:{' '}
                                            {log.message}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TestResults;