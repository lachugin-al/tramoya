import winston from 'winston';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';

// Create a namespace for storing request-specific data
import cls from 'cls-hooked';
const namespace = cls.createNamespace('tramoya-logger');

// Define a custom logger interface that includes the trace method
interface CustomLogger extends winston.Logger {
  trace(message: string, ...meta: any[]): CustomLogger;
}

// Log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  trace: 6
};

// Log level colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  trace: 'gray'
};

// Add colors to winston
winston.addColors(colors);

// Get hostname for additional context
const hostname = os.hostname();

/**
 * Middleware to set request ID in the CLS namespace
 */
export const requestIdMiddleware = (req: any, res: any, next: any) => {
  // Create a unique ID for each request
  const requestId = req.headers['x-request-id'] || uuidv4();
  
  // Set the request ID in the response headers
  res.setHeader('x-request-id', requestId);
  
  // Run the rest of the request in the context of the namespace
  namespace.run(() => {
    namespace.set('requestId', requestId);
    next();
  });
};

/**
 * Get the current request ID from the namespace
 */
export const getRequestId = (): string => {
  return namespace.get('requestId') || 'no-request-id';
};

/**
 * Creates a logger instance with the given module name
 * @param moduleName The name of the module to create a logger for
 * @returns A custom logger instance with trace method
 */
export const createLogger = (moduleName: string): CustomLogger => {
  const logDir = process.env.LOG_DIR || 'logs';
  const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
  
  // Ensure log directory exists
  const fs = require('fs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  // Custom format for adding request ID and other context
  const contextFormat = winston.format((info) => {
    const requestId = getRequestId();
    
    // Add context to log entry
    info.requestId = requestId;
    info.hostname = hostname;
    info.pid = process.pid;
    
    return info;
  });
  
  // Create the logger
  const logger = winston.createLogger({
    level: logLevel,
    levels,
    format: winston.format.combine(
      contextFormat(),
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),
    defaultMeta: { service: 'tramoya', module: moduleName },
    transports: [
      // Write all logs to console
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize({ all: true }),
          winston.format.printf(
            info => `${info.timestamp} ${info.level}: [${info.module}] [${info.requestId}] ${info.message}`
          )
        )
      }),
      
      // Write all logs with level 'info' and below to combined.log
      new winston.transports.File({ 
        filename: path.join(logDir, 'combined.log') 
      }),
      
      // Write all logs with level 'error' and below to error.log
      new winston.transports.File({ 
        filename: path.join(logDir, 'error.log'),
        level: 'error'
      }),
      
      // Write all logs with level 'http' to http.log
      new winston.transports.File({ 
        filename: path.join(logDir, 'http.log'),
        level: 'http'
      }),
      
      // Write all logs with level 'debug' and below to debug.log
      new winston.transports.File({ 
        filename: path.join(logDir, 'debug.log'),
        level: 'debug'
      })
    ]
  });

  // Add convenience methods for trace level
  (logger as CustomLogger).trace = (message: string, ...meta: any[]) => {
    logger.log('trace', message, ...meta);
    return logger as CustomLogger;
  };

  return logger as CustomLogger;
};

// Create a default logger
export const logger = createLogger('app');