/**
 * @fileoverview Application entry point that initializes the React application,
 * sets up logging, error handling, and renders the root component.
 * @module index
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { configureLogger, createLogger, LogLevel, enableServerLogging } from './utils/logger';

/**
 * Initialize and configure the application logger with environment-specific settings.
 * Sets different log levels based on the environment (INFO for production, DEBUG for development).
 */
configureLogger({
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  includeTimestamp: true,
  applicationName: 'tramoya-frontend'
});

/**
 * Enable server-side logging in production environment if a log endpoint is configured.
 * This allows sending logs to a centralized logging service for monitoring and debugging.
 */
if (process.env.NODE_ENV === 'production' && process.env.REACT_APP_LOG_ENDPOINT) {
  enableServerLogging(process.env.REACT_APP_LOG_ENDPOINT);
}

/**
 * Create a logger instance for the application entry point.
 * @const {Object} logger - The logger instance for the application entry point
 */
const logger = createLogger('app');
logger.info('Application initializing', {
  environment: process.env.NODE_ENV || 'development',
  version: process.env.REACT_APP_VERSION || 'unknown',
  buildTime: process.env.REACT_APP_BUILD_TIME || 'unknown',
  userAgent: navigator.userAgent
});

/**
 * Set up global error handler to log any unhandled errors that occur in the application.
 * This helps with debugging issues that might otherwise go unnoticed.
 * 
 * @listens window#error
 * @param {ErrorEvent} event - The error event containing details about the error
 */
window.addEventListener('error', (event) => {
  logger.error('Unhandled error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack
  });
});

/**
 * Set up global promise rejection handler to log any unhandled promise rejections.
 * This catches async errors that aren't properly caught in try/catch blocks.
 * 
 * @listens window#unhandledrejection
 * @param {PromiseRejectionEvent} event - The event containing details about the rejected promise
 */
window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection', {
    reason: event.reason?.message || String(event.reason),
    stack: event.reason?.stack
  });
});

/**
 * Logs navigation events with the current URL and path information.
 * This helps track user navigation patterns and debug routing issues.
 * 
 * @function
 * @returns {void}
 */
const logNavigation = () => {
  logger.debug('Navigation', {
    url: window.location.href,
    path: window.location.pathname
  });
};

// Log initial navigation when the application first loads
logNavigation();

/**
 * Set up event listener to log subsequent navigation events.
 * This captures navigation via browser back/forward buttons.
 * 
 * @listens window#popstate
 */
window.addEventListener('popstate', logNavigation);

/**
 * Create the React root for rendering the application.
 * This uses the new React 18 createRoot API for concurrent rendering.
 * 
 * @const {ReactDOM.Root} root - The React root instance
 */
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

logger.debug('Rendering root component');

/**
 * Render the application inside React.StrictMode for additional development checks.
 * The application is wrapped in BrowserRouter to enable React Router functionality.
 */
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

logger.info('Application initialized');