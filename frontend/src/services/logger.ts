/**
 * Frontend logging utility
 * 
 * This module provides a logging utility for the frontend that:
 * - Logs to the console with appropriate formatting and colors
 * - Supports different log levels (error, warn, info, debug, trace)
 * - Can send logs to the backend for persistent storage
 * - Includes context information like component name, user session, etc.
 */

// Log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

// Log level names
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.TRACE]: 'TRACE'
};

// Console styling for different log levels
const LOG_LEVEL_STYLES: Record<LogLevel, string> = {
  [LogLevel.ERROR]: 'color: #FF5252; font-weight: bold',
  [LogLevel.WARN]: 'color: #FFC107; font-weight: bold',
  [LogLevel.INFO]: 'color: #2196F3',
  [LogLevel.DEBUG]: 'color: #4CAF50',
  [LogLevel.TRACE]: 'color: #9E9E9E'
};

// Default log level based on environment
const DEFAULT_LOG_LEVEL = process.env.NODE_ENV === 'production' 
  ? LogLevel.INFO 
  : LogLevel.DEBUG;

// Configuration for the logger
interface LoggerConfig {
  level: LogLevel;
  sendToServer: boolean;
  serverEndpoint?: string;
  includeTimestamp: boolean;
  applicationName: string;
}

// Default configuration
const DEFAULT_CONFIG: LoggerConfig = {
  level: DEFAULT_LOG_LEVEL,
  sendToServer: false,
  includeTimestamp: true,
  applicationName: 'tramoya-frontend'
};

// Global configuration that can be updated at runtime
let globalConfig: LoggerConfig = { ...DEFAULT_CONFIG };

// Generate a unique session ID for this browser session
const SESSION_ID = Math.random().toString(36).substring(2, 15);

/**
 * Configure the global logger settings
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  globalConfig = { ...globalConfig, ...config };
  
  // Log the configuration change
  const logger = createLogger('logger');
  logger.debug('Logger configuration updated', { config: globalConfig });
}

/**
 * Get the current log level
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
 * Set the log level
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
 * Format a log message with timestamp and module name
 */
function formatLogMessage(level: LogLevel, moduleName: string, message: string): string {
  const timestamp = globalConfig.includeTimestamp ? `[${new Date().toISOString()}] ` : '';
  return `${timestamp}${LOG_LEVEL_NAMES[level]} [${moduleName}] ${message}`;
}

/**
 * Send a log to the server if configured
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
 * Logger class for a specific module
 */
export class Logger {
  private moduleName: string;
  
  constructor(moduleName: string) {
    this.moduleName = moduleName;
  }
  
  /**
   * Log a message at a specific level
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
   * Log an error message
   */
  error(message: string, ...data: any[]): void {
    this.log(LogLevel.ERROR, message, ...data);
  }
  
  /**
   * Log a warning message
   */
  warn(message: string, ...data: any[]): void {
    this.log(LogLevel.WARN, message, ...data);
  }
  
  /**
   * Log an info message
   */
  info(message: string, ...data: any[]): void {
    this.log(LogLevel.INFO, message, ...data);
  }
  
  /**
   * Log a debug message
   */
  debug(message: string, ...data: any[]): void {
    this.log(LogLevel.DEBUG, message, ...data);
  }
  
  /**
   * Log a trace message
   */
  trace(message: string, ...data: any[]): void {
    this.log(LogLevel.TRACE, message, ...data);
  }
  
  /**
   * Log the start of a performance measurement
   */
  time(label: string): void {
    if (getLogLevel() >= LogLevel.DEBUG) {
      console.time(`[${this.moduleName}] ${label}`);
    }
  }
  
  /**
   * Log the end of a performance measurement
   */
  timeEnd(label: string): void {
    if (getLogLevel() >= LogLevel.DEBUG) {
      console.timeEnd(`[${this.moduleName}] ${label}`);
    }
  }
  
  /**
   * Log a group of related messages
   */
  group(label: string): void {
    if (getLogLevel() >= LogLevel.DEBUG) {
      console.group(`[${this.moduleName}] ${label}`);
    }
  }
  
  /**
   * End a group of related messages
   */
  groupEnd(): void {
    if (getLogLevel() >= LogLevel.DEBUG) {
      console.groupEnd();
    }
  }
}

/**
 * Create a logger for a specific module
 */
export function createLogger(moduleName: string): Logger {
  return new Logger(moduleName);
}

// Create a default logger
export const logger = createLogger('app');

// Export a function to enable server logging
export function enableServerLogging(endpoint: string): void {
  configureLogger({
    sendToServer: true,
    serverEndpoint: endpoint
  });
}