/**
 * Test component to verify that the frontend logging system works as expected.
 * 
 * This component:
 * 1. Creates loggers for different modules
 * 2. Logs messages at different levels
 * 3. Demonstrates performance measurement
 * 4. Simulates API calls with logging
 * 5. Simulates error conditions
 * 
 * To use this component, temporarily replace the App component in index.tsx:
 * import TestLogging from './test-logging';
 * ...
 * root.render(
 *   <React.StrictMode>
 *     <BrowserRouter>
 *       <TestLogging />
 *     </BrowserRouter>
 *   </React.StrictMode>
 * );
 */

import React, { useEffect, useState } from 'react';
import { 
  createLogger, 
  LogLevel, 
  configureLogger, 
  setLogLevel 
} from './utils/logger';

/**
 * Create loggers for different modules to demonstrate module-specific logging
 * 
 * @const {Object} mainLogger - Logger for the main test-logging component
 */
const mainLogger = createLogger('test-logging');

/**
 * @const {Object} uiLogger - Logger for UI-related events
 */
const uiLogger = createLogger('test-ui');

/**
 * @const {Object} apiLogger - Logger for API-related events
 */
const apiLogger = createLogger('test-api');

/**
 * Configure the logger with test-specific settings
 * Set to TRACE level to demonstrate all log levels
 */
configureLogger({
  level: LogLevel.TRACE, // Set to TRACE to see all logs
  includeTimestamp: true,
  applicationName: 'tramoya-frontend-test'
});

/**
 * Test component that demonstrates the frontend logging system capabilities.
 * This component shows various logging features including different log levels,
 * performance measurement, error handling, and grouped logs.
 * 
 * @component
 * @returns {JSX.Element} The rendered TestLogging component with interactive controls
 */
const TestLogging: React.FC = () => {
  const [count, setCount] = useState(0);
  const [logLevel, setLoggerLevel] = useState<LogLevel>(LogLevel.TRACE);
  const [error, setError] = useState<string | null>(null);

  // Log component initialization
  useEffect(() => {
    mainLogger.info('TestLogging component initialized', {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      windowSize: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    });

    // Log at different levels
    mainLogger.error('This is an ERROR level message');
    mainLogger.warn('This is a WARN level message');
    mainLogger.info('This is an INFO level message');
    mainLogger.debug('This is a DEBUG level message');
    mainLogger.trace('This is a TRACE level message');

    // Demonstrate performance measurement
    mainLogger.time('initialization');
    
    // Simulate some initialization work
    setTimeout(() => {
      mainLogger.timeEnd('initialization');
      mainLogger.info('Initialization complete');
    }, 500);

    // Simulate API calls
    simulateApiCalls();

    // Cleanup function
    return () => {
      mainLogger.info('TestLogging component unmounting');
    };
  }, []);

  /**
   * Simulates API calls with success and failure scenarios to demonstrate logging patterns.
   * This function shows how to log API requests, responses, timing information, and errors.
   * 
   * @async
   * @function simulateApiCalls
   * @returns {Promise<void>} A promise that resolves when all simulated API calls are complete
   */
  const simulateApiCalls = async () => {
    apiLogger.info('Starting API call simulation');

    // Successful API call
    apiLogger.debug('Making successful API call');
    try {
      const startTime = Date.now();
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300));
      
      apiLogger.info('API call succeeded', {
        endpoint: '/api/test',
        method: 'GET',
        duration: `${Date.now() - startTime}ms`,
        response: { status: 'success', data: { id: 123, name: 'Test' } }
      });
    } catch (err) {
      apiLogger.error('API call failed', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });
    }

    // Failed API call
    apiLogger.debug('Making failing API call');
    const failedCallStartTime = Date.now();
    try {
      // Simulate API call that fails
      await new Promise((_, reject) => 
        setTimeout(() => reject(new Error('API error')), 200)
      );
      
    } catch (err) {
      apiLogger.error('API call failed', {
        endpoint: '/api/test/error',
        method: 'POST',
        duration: `${Date.now() - failedCallStartTime}ms`,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });
    }
  };

  /**
   * Handles the button click event to increment the counter.
   * Demonstrates logging UI interactions with contextual data.
   * 
   * @function handleClick
   * @returns {void}
   */
  const handleClick = () => {
    uiLogger.debug('Button clicked', { count });
    setCount(prevCount => prevCount + 1);
  };

  /**
   * Changes the current log level for the application.
   * Demonstrates how to dynamically adjust logging verbosity.
   * 
   * @function handleLogLevelChange
   * @param {LogLevel} level - The new log level to set
   * @returns {void}
   */
  const handleLogLevelChange = (level: LogLevel) => {
    uiLogger.info(`Changing log level to ${LogLevel[level]}`);
    setLoggerLevel(level);
    setLogLevel(level);
  };

  /**
   * Simulates an error condition and demonstrates error logging.
   * Shows how to properly catch, log, and handle errors.
   * 
   * @function simulateError
   * @returns {void}
   */
  const simulateError = () => {
    uiLogger.debug('Simulating error');
    try {
      // Intentionally cause an error
      throw new Error('Simulated error');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      uiLogger.error('Error occurred', {
        error: errorMessage,
        stack: err instanceof Error ? err.stack : undefined
      });
      setError(errorMessage);
    }
  };

  /**
   * Clears the current error state.
   * Demonstrates logging state changes and error recovery.
   * 
   * @function clearError
   * @returns {void}
   */
  const clearError = () => {
    uiLogger.debug('Clearing error');
    setError(null);
  };

  /**
   * Demonstrates grouped log messages for related information.
   * Shows how to organize logs for better readability in the console.
   * 
   * @function logGroupedMessages
   * @returns {void}
   */
  const logGroupedMessages = () => {
    uiLogger.group('Button click details');
    uiLogger.debug('Button component', { id: 'test-button' });
    uiLogger.debug('Click count', { count });
    uiLogger.debug('Timestamp', { time: new Date().toISOString() });
    uiLogger.groupEnd();
  };

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h1>Frontend Logger Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Current State</h2>
        <p>Count: {count}</p>
        <p>Log Level: {LogLevel[logLevel]}</p>
        {error && (
          <div style={{ 
            backgroundColor: '#ffebee', 
            padding: '10px', 
            borderRadius: '4px',
            marginBottom: '10px'
          }}>
            <p>Error: {error}</p>
            <button onClick={clearError}>Clear Error</button>
          </div>
        )}
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Actions</h2>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <button onClick={handleClick}>
            Increment Count
          </button>
          <button onClick={simulateError}>
            Simulate Error
          </button>
          <button onClick={logGroupedMessages}>
            Log Grouped Messages
          </button>
          <button onClick={() => simulateApiCalls()}>
            Simulate API Calls
          </button>
        </div>
        
        <h3>Change Log Level</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          {Object.keys(LogLevel)
            .filter(key => !isNaN(Number(key)))
            .map(level => (
              <button 
                key={level}
                onClick={() => handleLogLevelChange(Number(level))}
                style={{
                  fontWeight: Number(level) === logLevel ? 'bold' : 'normal',
                  backgroundColor: Number(level) === logLevel ? '#e3f2fd' : ''
                }}
              >
                {LogLevel[Number(level)]}
              </button>
            ))}
        </div>
      </div>
      
      <div>
        <h2>Instructions</h2>
        <ol>
          <li>Open the browser console to see the logs</li>
          <li>Try different actions and observe the logs</li>
          <li>Change the log level to see how it affects which logs are displayed</li>
          <li>Check the console for grouped logs and performance measurements</li>
        </ol>
      </div>
    </div>
  );
};

export default TestLogging;