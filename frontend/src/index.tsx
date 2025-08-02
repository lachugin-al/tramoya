import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { configureLogger, createLogger, LogLevel, enableServerLogging } from './utils/logger';

// Initialize and configure the logger
configureLogger({
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  includeTimestamp: true,
  applicationName: 'tramoya-frontend'
});

// Enable server logging in production
if (process.env.NODE_ENV === 'production' && process.env.REACT_APP_LOG_ENDPOINT) {
  enableServerLogging(process.env.REACT_APP_LOG_ENDPOINT);
}

// Create a logger for the application entry point
const logger = createLogger('app');
logger.info('Application initializing', {
  environment: process.env.NODE_ENV || 'development',
  version: process.env.REACT_APP_VERSION || 'unknown',
  buildTime: process.env.REACT_APP_BUILD_TIME || 'unknown',
  userAgent: navigator.userAgent
});

// Log any unhandled errors
window.addEventListener('error', (event) => {
  logger.error('Unhandled error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack
  });
});

// Log any unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection', {
    reason: event.reason?.message || String(event.reason),
    stack: event.reason?.stack
  });
});

// Log navigation events
const logNavigation = () => {
  logger.debug('Navigation', {
    url: window.location.href,
    path: window.location.pathname
  });
};

// Log initial navigation
logNavigation();

// Log subsequent navigations
window.addEventListener('popstate', logNavigation);

// Create and render the root component
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

logger.debug('Rendering root component');

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

logger.info('Application initialized');