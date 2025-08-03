import winston from 'winston';
import path from 'path';
import {v4 as uuidv4} from 'uuid';
import os from 'os';

// Create a namespace for storing request-specific data
import cls from 'cls-hooked';

/**
 * Continuation-Local Storage namespace for storing request-specific data
 * This namespace allows us to maintain context across async operations
 * @private
 */
const namespace = cls.createNamespace('tramoya-logger');

/**
 * Custom logger interface that extends Winston Logger with additional functionality
 * Adds a trace level logging method not provided by default Winston
 * @interface
 */
interface CustomLogger extends winston.Logger {
    /**
     * Log a message at the 'trace' level (most detailed logging level)
     * @param message - The message to log
     * @param meta - Additional metadata to include in the log
     * @returns The logger instance for chaining
     * @example
     * const logger = createLogger('my-module');
     * logger.trace('Detailed trace information', { key: 'value' });
     */
    trace(message: string, ...meta: any[]): CustomLogger;
}

/**
 * Log levels configuration with numeric priorities
 * Lower numbers indicate higher priority levels
 * @constant
 * @type {Object.<string, number>}
 */
const levels = {
    error: 0,   // Critical errors that require immediate attention
    warn: 1,    // Warning conditions that should be addressed
    info: 2,    // Informational messages about normal operation
    http: 3,    // HTTP request-specific information
    verbose: 4, // More detailed informational messages
    debug: 5,   // Debugging information for development
    trace: 6    // Most detailed level for tracing code execution
};

/**
 * Color configuration for different log levels in console output
 * Maps each log level to a specific color for better visual distinction
 * @constant
 * @type {Object.<string, string>}
 */
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

/**
 * System hostname used for adding context to log entries
 * @constant
 * @private
 */
const hostname = os.hostname();

/**
 * Express middleware that sets a unique request ID for each incoming request
 * This middleware enables request tracking across the application by:
 * 1. Extracting an existing request ID from headers or generating a new UUID
 * 2. Setting the request ID in response headers for client-side tracking
 * 3. Storing the request ID in the CLS namespace for access throughout the request lifecycle
 *
 * @param {any} req - Express request object
 * @param {any} res - Express response object
 * @param {Function} next - Express next middleware function
 *
 * @example
 * // In your Express app setup:
 * import express from 'express';
 * import { requestIdMiddleware } from './utils/logger';
 *
 * const app = express();
 * app.use(requestIdMiddleware);
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
 * Retrieves the current request ID from the CLS namespace
 * This function allows any part of the application to access the current request ID
 * without having to pass it explicitly through function parameters
 *
 * @returns {string} The current request ID or 'no-request-id' if not in a request context
 *
 * @example
 * // In any file where you need the current request ID:
 * import { getRequestId } from './utils/logger';
 *
 * function processData() {
 *   const requestId = getRequestId();
 *   // Use requestId in processing or error reporting
 * }
 */
export const getRequestId = (): string => {
    return namespace.get('requestId') || 'no-request-id';
};

/**
 * Creates a configured logger instance with the given module name
 * This function creates a Winston logger with custom formatting, multiple transports,
 * and contextual metadata including request IDs, hostname, and process ID.
 *
 * @param {string} moduleName - The name of the module to create a logger for
 *                             (used in log output to identify the source)
 * @returns {CustomLogger} A configured logger instance with all standard Winston methods
 *                        plus the additional trace level method
 *
 * @example
 * // Create a logger for a specific module
 * import { createLogger } from './utils/logger';
 *
 * const logger = createLogger('user-service');
 * logger.info('User service initialized');
 * logger.error('Failed to connect to database', { error: err.message });
 * logger.debug('Processing request', { userId: '123', action: 'login' });
 * logger.trace('Detailed execution path', { step: 3, data: someData });
 *
 * @description
 * The logger created by this function:
 * - Outputs to console with colors based on log level
 * - Writes to multiple log files based on log level
 * - Automatically includes timestamp, module name, and request ID in all logs
 * - Supports environment variable configuration:
 *   - LOG_DIR: Directory to store log files (default: 'logs')
 *   - LOG_LEVEL: Minimum log level to record (default: 'debug' in development, 'info' in production)
 *   - NODE_ENV: Used to determine default log level
 */
export const createLogger = (moduleName: string): CustomLogger => {
    const logDir = process.env.LOG_DIR || 'logs';
    const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

    // Ensure log directory exists
    const fs = require('fs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, {recursive: true});
    }

    /**
     * Custom Winston format that adds contextual information to each log entry
     * Adds request ID (from CLS namespace), hostname, and process ID
     * @private
     */
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
            winston.format.errors({stack: true}),
            winston.format.splat(),
            winston.format.json()
        ),
        defaultMeta: {service: 'tramoya', module: moduleName},
        transports: [
            // Write all logs to console
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize({all: true}),
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

    /**
     * Add trace level method to the logger
     * This extends Winston with our custom trace level functionality
     * @private
     */
    (logger as CustomLogger).trace = (message: string, ...meta: any[]) => {
        logger.log('trace', message, ...meta);
        return logger as CustomLogger;
    };

    return logger as CustomLogger;
};

/**
 * Default application-wide logger instance
 * This pre-configured logger can be imported and used directly
 * without having to create a new logger instance
 *
 * @example
 * // In any file where you need logging:
 * import { logger } from './utils/logger';
 *
 * logger.info('Application started');
 * logger.error('An error occurred', { error: err });
 */
export const logger = createLogger('app');