/**
 * Express module augmentation
 * 
 * This file extends the Express Response interface with additional functionality.
 * It adds methods that are not part of the standard Express types but are used
 * in this application.
 * 
 * @module types/express
 */
import 'express';

declare global {
  namespace Express {
    interface Response {
      /**
       * Flushes the response data to the client immediately
       * 
       * This method is particularly useful for streaming responses where data
       * needs to be sent to the client before the entire response is ready.
       * It forces any buffered output to be sent to the client without waiting
       * for the response to complete.
       * 
       * Usage example:
       * ```typescript
       * res.write('Some data');
       * res.flush?.();
       * // Continue processing...
       * ```
       * 
       * Note: This method is optional (marked with '?') as it may not be available
       * in all Express environments or middleware configurations.
       * 
       * @returns {void} This method does not return a value
       */
      flush?: () => void;
    }
  }
}