/**
 * Winston module augmentation
 * 
 * This file extends the Winston Logger interface with additional logging functionality.
 * It adds logging methods that are not part of the standard Winston types but are
 * used in this application to provide more granular logging levels.
 * 
 * @module types/winston
 */
import 'winston';

declare module 'winston' {
  interface Logger {
    /**
     * Logs a trace level message
     * 
     * This method adds a trace level logging capability to the Winston logger,
     * which is typically used for very detailed debugging information. The trace
     * level is considered more verbose than debug level and is useful for
     * capturing fine-grained execution flow during development or troubleshooting.
     * 
     * The trace level is not included in Winston by default, which is why this
     * type augmentation is necessary.
     * 
     * Usage example:
     * ```typescript
     * logger.trace('Entering function', { functionName: 'processData', args: [1, 2, 3] });
     * // Process data...
     * logger.trace('Exiting function', { functionName: 'processData', result: 'success' });
     * ```
     * 
     * @param {string} message - The message to log
     * @param {...any[]} meta - Additional metadata to include in the log (objects, arrays, or primitive values)
     * @returns {Logger} - The logger instance for method chaining
     */
    trace(message: string, ...meta: any[]): Logger;
  }
}