/**
 * Frontend logging utility module
 * 
 * This module provides a comprehensive logging utility for the frontend application that:
 * - Logs to the console with appropriate formatting and colors
 * - Supports different log levels (error, warn, info, debug, trace)
 * - Can send logs to the backend for persistent storage
 * - Includes context information like component name, user session, etc.
 * - Allows runtime configuration of logging behavior
 * 
 * The logger is designed to be easy to use while providing powerful features for debugging
 * and monitoring the application.
 * 
 * @module logger
 */

/**
 * Enumeration of available log levels in order of increasing verbosity
 * 
 * @enum {number}
 */
export enum LogLevel {
  /** Critical errors that prevent the application from functioning */
  ERROR = 0,
  
  /** Warnings about potential issues that don't prevent the application from functioning */
  WARN = 1,
  
  /** Informational messages about normal application operation */
  INFO = 2,
  
  /** Detailed information useful for debugging */
  DEBUG = 3,
  
  /** Very detailed tracing information */
  TRACE = 4
}

/**
 * Mapping of log levels to their string representations
 * Used for displaying log level names in log messages
 * 
 * @internal
 */
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.TRACE]: 'TRACE'
};

/**
 * CSS styling for different log levels in the console
 * Used to visually distinguish between different types of log messages
 * 
 * @internal
 */
const LOG_LEVEL_STYLES: Record<LogLevel, string> = {
  [LogLevel.ERROR]: 'color: #FF5252; font-weight: bold',
  [LogLevel.WARN]: 'color: #FFC107; font-weight: bold',
  [LogLevel.INFO]: 'color: #2196F3',
  [LogLevel.DEBUG]: 'color: #4CAF50',
  [LogLevel.TRACE]: 'color: #9E9E9E'
};

/**
 * Default log level based on the current environment
 * In production, default to INFO level to reduce noise
 * In development, default to DEBUG level for more detailed information
 * 
 * @internal
 */
const DEFAULT_LOG_LEVEL = process.env.NODE_ENV === 'production' 
  ? LogLevel.INFO 
  : LogLevel.DEBUG;

/**
 * Configuration interface for the logger
 * 
 * @interface LoggerConfig
 * @property {LogLevel} level - The current log level
 * @property {boolean} sendToServer - Whether to send logs to the server
 * @property {string} [serverEndpoint] - The endpoint to send logs to (if sendToServer is true)
 * @property {boolean} includeTimestamp - Whether to include timestamps in log messages
 * @property {string} applicationName - The name of the application (used in server logs)
 */
interface LoggerConfig {
  level: LogLevel;
  sendToServer: boolean;
  serverEndpoint?: string;
  includeTimestamp: boolean;
  applicationName: string;
}

/**
 * Default configuration for the logger
 * 
 * @internal
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: DEFAULT_LOG_LEVEL,
  sendToServer: false,
  includeTimestamp: true,
  applicationName: 'tramoya-frontend'
};

/**
 * Global configuration that can be updated at runtime
 * 
 * @internal
 */
let globalConfig: LoggerConfig = { ...DEFAULT_CONFIG };

/**
 * Unique session ID for this browser session
 * Used to correlate logs from the same session
 * 
 * @internal
 */
const SESSION_ID = Math.random().toString(36).substring(2, 15);

/**
 * Configures the global logger settings
 * 
 * This function allows you to customize the behavior of all loggers in the application.
 * Settings are merged with the existing configuration, so you only need to specify
 * the settings you want to change.
 * 
 * @param {Partial<LoggerConfig>} config - Partial configuration to apply
 * 
 * @example
 * // Enable sending logs to the server
 * configureLogger({
 *   sendToServer: true,
 *   serverEndpoint: '/api/logs'
 * });
 * 
 * @example
 * // Change the log level
 * configureLogger({
 *   level: LogLevel.DEBUG
 * });
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  globalConfig = { ...globalConfig, ...config };
  
  // Log the configuration change
  const logger = createLogger('logger');
  logger.debug('Logger configuration updated', { config: globalConfig });
}

/**
 * Gets the current log level
 * 
 * This function checks for a log level in localStorage first (for development),
 * and falls back to the global configuration if not found.
 * 
 * @returns {LogLevel} The current log level
 * 
 * @example
 * // Check the current log level
 * const level = getLogLevel();
 * if (level >= LogLevel.DEBUG) {
 *   console.log('Debug logging is enabled');
 * }
 */
export function getLogLevel(): LogLevel {
  // Check for log level in localStorage (for development)
  if (typeof localStorage !== 'undefined') {
    const localStorageLevel = localStorage.getItem('logLevel');
    if (localStorageLevel && Object.values(LogLevel).includes(Number(localStorageLevel) as LogLevel)) {
      return Number(localStorageLevel) as LogLevel;
    }
  }
  
  return globalConfig.level;
}

/**
 * Sets the log level
 * 
 * This function updates the global log level and stores it in localStorage
 * for persistence during development.
 * 
 * @param {LogLevel} level - The new log level to set
 * 
 * @example
 * // Set the log level to DEBUG
 * setLogLevel(LogLevel.DEBUG);
 * 
 * @example
 * // Disable all but error logs
 * setLogLevel(LogLevel.ERROR);
 */
export function setLogLevel(level: LogLevel): void {
  globalConfig.level = level;
  
  // Also store in localStorage for persistence during development
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('logLevel', level.toString());
  }
  
  const logger = createLogger('logger');
  logger.info(`Log level set to ${LOG_LEVEL_NAMES[level]}`);
}

/**
 * Formats a log message with timestamp and module name
 * 
 * @internal
 * @param {LogLevel} level - The log level
 * @param {string} moduleName - The name of the module or component
 * @param {string} message - The log message
 * @returns {string} The formatted log message
 */
function formatLogMessage(level: LogLevel, moduleName: string, message: string): string {
  const timestamp = globalConfig.includeTimestamp ? `[${new Date().toISOString()}] ` : '';
  return `${timestamp}${LOG_LEVEL_NAMES[level]} [${moduleName}] ${message}`;
}

/**
 * Sends a log message to the server if server logging is configured
 * 
 * This function sends log data to the configured server endpoint using a POST request.
 * It includes additional context information such as timestamp, session ID, and browser details.
 * 
 * @internal
 * @param {LogLevel} level - The log level
 * @param {string} moduleName - The name of the module or component
 * @param {string} message - The log message
 * @param {any} [data] - Optional additional data to include with the log
 * @returns {Promise<void>} A promise that resolves when the log is sent or rejected
 */
async function sendLogToServer(
  level: LogLevel, 
  moduleName: string, 
  message: string, 
  data?: any
): Promise<void> {
  if (!globalConfig.sendToServer || !globalConfig.serverEndpoint) {
    return;
  }
  
  try {
    const logData = {
      level: LOG_LEVEL_NAMES[level],
      module: moduleName,
      message,
      timestamp: new Date().toISOString(),
      sessionId: SESSION_ID,
      application: globalConfig.applicationName,
      data,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    // Send log to server
    await fetch(globalConfig.serverEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(logData),
      // Don't wait for response or handle errors
      keepalive: true
    });
  } catch (error) {
    // Don't log this error to avoid infinite loops
    console.error('Error sending log to server:', error);
  }
}

/**
 * Logger class for a specific module or component
 * 
 * This class provides methods for logging messages at different levels (error, warn, info, debug, trace)
 * and includes utilities for performance measurement and grouping related logs.
 * 
 * @class Logger
 */
export class Logger {
  /**
   * The name of the module or component this logger is for
   * @private
   */
  private moduleName: string;
  
  /**
   * Creates a new Logger instance for a specific module
   * 
   * @param {string} moduleName - The name of the module or component this logger is for
   */
  constructor(moduleName: string) {
    this.moduleName = moduleName;
  }
  
  /**
   * Logs a message at a specific level
   * 
   * This is the core logging method that all other logging methods (error, warn, info, etc.) call.
   * It formats the message, logs it to the console with appropriate styling, and sends it to the
   * server if configured.
   * 
   * @private
   * @param {LogLevel} level - The log level
   * @param {string} message - The message to log
   * @param {...any[]} data - Optional additional data to log
   */
  private log(level: LogLevel, message: string, ...data: any[]): void {
    // Check if this level should be logged
    if (level > getLogLevel()) {
      return;
    }
    
    const formattedMessage = formatLogMessage(level, this.moduleName, message);
    
    // Log to console with appropriate styling
    if (data.length > 0) {
      console.log(`%c${formattedMessage}`, LOG_LEVEL_STYLES[level], ...data);
    } else {
      console.log(`%c${formattedMessage}`, LOG_LEVEL_STYLES[level]);
    }
    
    // Send to server if configured
    if (globalConfig.sendToServer) {
      sendLogToServer(level, this.moduleName, message, data.length > 0 ? data : undefined);
    }
  }
  
  /**
   * Logs an error message
   * 
   * Use this method for critical errors that prevent the application from functioning correctly.
   * 
   * @param {string} message - The error message
   * @param {...any[]} data - Optional additional data (objects, errors, etc.)
   * 
   * @example
   * const logger = createLogger('AuthService');
   * try {
   *   // Some code that might throw
   * } catch (err) {
   *   logger.error('Failed to authenticate user', err, { userId: '123' });
   * }
   */
  error(message: string, ...data: any[]): void {
    this.log(LogLevel.ERROR, message, ...data);
  }
  
  /**
   * Logs a warning message
   * 
   * Use this method for potential issues that don't prevent the application from functioning.
   * 
   * @param {string} message - The warning message
   * @param {...any[]} data - Optional additional data
   * 
   * @example
   * logger.warn('API response was slow', { responseTime: 3500, endpoint: '/users' });
   */
  warn(message: string, ...data: any[]): void {
    this.log(LogLevel.WARN, message, ...data);
  }
  
  /**
   * Logs an informational message
   * 
   * Use this method for normal application events that are significant for business logic.
   * 
   * @param {string} message - The info message
   * @param {...any[]} data - Optional additional data
   * 
   * @example
   * logger.info('User logged in successfully', { userId: '123', role: 'admin' });
   */
  info(message: string, ...data: any[]): void {
    this.log(LogLevel.INFO, message, ...data);
  }
  
  /**
   * Logs a debug message
   * 
   * Use this method for detailed information useful during debugging.
   * 
   * @param {string} message - The debug message
   * @param {...any[]} data - Optional additional data
   * 
   * @example
   * logger.debug('Processing form submission', { formData, validationResult });
   */
  debug(message: string, ...data: any[]): void {
    this.log(LogLevel.DEBUG, message, ...data);
  }
  
  /**
   * Logs a trace message
   * 
   * Use this method for very detailed tracing information.
   * 
   * @param {string} message - The trace message
   * @param {...any[]} data - Optional additional data
   * 
   * @example
   * logger.trace('Entering function', { args });
   */
  trace(message: string, ...data: any[]): void {
    this.log(LogLevel.TRACE, message, ...data);
  }
  
  /**
   * Starts a performance measurement timer
   * 
   * Use this method in conjunction with timeEnd() to measure the duration of operations.
   * 
   * @param {string} label - A unique label for the timer
   * 
   * @example
   * logger.time('fetchData');
   * const data = await fetchData();
   * logger.timeEnd('fetchData'); // Logs: [ComponentName] fetchData: 123.45ms
   */
  time(label: string): void {
    if (getLogLevel() >= LogLevel.DEBUG) {
      console.time(`[${this.moduleName}] ${label}`);
    }
  }
  
  /**
   * Ends a performance measurement timer and logs the duration
   * 
   * @param {string} label - The label used with the corresponding time() call
   * 
   * @example
   * logger.time('processData');
   * processData();
   * logger.timeEnd('processData');
   */
  timeEnd(label: string): void {
    if (getLogLevel() >= LogLevel.DEBUG) {
      console.timeEnd(`[${this.moduleName}] ${label}`);
    }
  }
  
  /**
   * Starts a collapsible group of log messages in the console
   * 
   * Use this method to group related log messages together.
   * 
   * @param {string} label - The label for the group
   * 
   * @example
   * logger.group('User Authentication');
   * logger.debug('Validating credentials');
   * logger.debug('Checking permissions');
   * logger.groupEnd();
   */
  group(label: string): void {
    if (getLogLevel() >= LogLevel.DEBUG) {
      console.group(`[${this.moduleName}] ${label}`);
    }
  }
  
  /**
   * Ends a group of log messages
   * 
   * @example
   * logger.group('Data Processing');
   * // ... logs
   * logger.groupEnd();
   */
  groupEnd(): void {
    if (getLogLevel() >= LogLevel.DEBUG) {
      console.groupEnd();
    }
  }
}

/**
 * Creates a logger instance for a specific module or component
 * 
 * This is the main factory function for creating loggers in the application.
 * 
 * @param {string} moduleName - The name of the module or component
 * @returns {Logger} A new Logger instance
 * 
 * @example
 * // Create a logger for a component
 * const logger = createLogger('UserProfile');
 * 
 * // Use the logger
 * logger.info('Component mounted');
 * logger.debug('Props received', props);
 */
export function createLogger(moduleName: string): Logger {
  return new Logger(moduleName);
}

/**
 * Default application-level logger
 * 
 * Use this logger for general application logging when a more specific
 * module or component logger is not appropriate.
 * 
 * @example
 * import { logger } from '../utils/logger';
 * 
 * logger.info('Application started');
 */
export const logger = createLogger('app');

/**
 * Enables sending logs to a server endpoint
 * 
 * This is a convenience function for configuring server logging.
 * 
 * @param {string} endpoint - The URL endpoint to send logs to
 * 
 * @example
 * // Enable sending logs to the server
 * enableServerLogging('/api/logs');
 */
export function enableServerLogging(endpoint: string): void {
  configureLogger({
    sendToServer: true,
    serverEndpoint: endpoint
  });
}