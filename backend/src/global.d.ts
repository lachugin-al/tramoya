/**
 * Type declarations for extending external modules.
 *
 * This file extends the Winston Logger interface to add a trace method,
 * which provides an additional logging level below debug for very detailed logging.
 *
 * @module global
 */

import 'winston';

declare module 'winston' {
    interface Logger {
        /**
         * Log a message at the trace level (more detailed than debug level).
         *
         * @param {string} message - The message to log
         * @param {...any[]} meta - Additional metadata to include in the log
         * @returns {Logger} The logger instance for chaining
         */
        trace(message: string, ...meta: any[]): Logger;
    }
}