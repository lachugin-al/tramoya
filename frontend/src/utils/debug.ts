/**
 * Debug utility module for logging and troubleshooting
 *
 * This module provides utility functions for debugging, logging, and verifying resources
 * in the application. It includes functions for logging messages at different levels,
 * tracking state changes, and verifying image URLs.
 *
 * The module's behavior can be controlled through configuration constants:
 * - DEBUG_MODE: Controls whether debug logging is enabled
 * - IMAGE_DEBUG_MODE: Controls whether image URL verification is enabled
 *
 * @module debug
 */

/**
 * Controls whether debug logging is enabled
 * When false, debug logging functions will not output anything
 */
const DEBUG_MODE = false;

/**
 * Controls whether image URL verification is enabled
 * When false, image verification functions will not perform any checks
 */
const IMAGE_DEBUG_MODE = false;

/**
 * Logs a debug message to the console
 *
 * This function outputs a formatted debug message to the console when DEBUG_MODE is enabled.
 * It prefixes the message with the component name and optionally logs additional data.
 *
 * @param {string} component - The component or module name (used as a prefix in the log)
 * @param {string} message - The message to log
 * @param {any} [data] - Optional data to log alongside the message
 *
 * @example
 * // Basic usage
 * debugLog('UserComponent', 'User data loaded');
 *
 * // With additional data
 * debugLog('UserComponent', 'User data loaded', { userId: '123', name: 'John' });
 */
export const debugLog = (component: string, message: string, data?: any) => {
    if (!DEBUG_MODE) return;

    console.log(`[DEBUG][${component}] ${message}`);
    if (data !== undefined) {
        console.log(`[DEBUG][${component}] Data:`, data);
    }
};

/**
 * Logs an error message to the console
 *
 * This function outputs a formatted error message to the console when DEBUG_MODE is enabled.
 * It prefixes the message with the component name and optionally logs an error object.
 *
 * @param {string} component - The component or module name (used as a prefix in the log)
 * @param {string} message - The error message to log
 * @param {any} [error] - Optional error object to log alongside the message
 *
 * @example
 * // Basic usage
 * debugError('ApiService', 'Failed to fetch data');
 *
 * // With error object
 * try {
 *   // Some code that might throw
 * } catch (err) {
 *   debugError('ApiService', 'Failed to fetch data', err);
 * }
 */
export const debugError = (component: string, message: string, error?: any) => {
    if (!DEBUG_MODE) return;

    console.error(`[ERROR][${component}] ${message}`);
    if (error !== undefined) {
        console.error(`[ERROR][${component}] Error:`, error);
    }
};

/**
 * Logs a warning message to the console
 *
 * This function outputs a formatted warning message to the console when DEBUG_MODE is enabled.
 * It prefixes the message with the component name and optionally logs additional data.
 *
 * @param {string} component - The component or module name (used as a prefix in the log)
 * @param {string} message - The warning message to log
 * @param {any} [data] - Optional data to log alongside the message
 *
 * @example
 * // Basic usage
 * debugWarn('FormComponent', 'Form submitted with validation warnings');
 *
 * // With additional data
 * debugWarn('FormComponent', 'Form submitted with validation warnings', {
 *   fields: ['email', 'phone'],
 *   values: { email: 'invalid-email', phone: '' }
 * });
 */
export const debugWarn = (component: string, message: string, data?: any) => {
    if (!DEBUG_MODE) return;

    console.warn(`[WARN][${component}] ${message}`);
    if (data !== undefined) {
        console.warn(`[WARN][${component}] Data:`, data);
    }
};

/**
 * Formats an object for logging
 *
 * This utility function converts an object to a formatted JSON string for better readability
 * in logs. It handles serialization errors gracefully by returning a descriptive string.
 *
 * @param {any} obj - The object to format
 * @returns {string} A formatted string representation of the object
 *
 * @example
 * // Basic usage
 * const user = { id: 123, name: 'John', roles: ['admin', 'user'] };
 * console.log(formatObject(user));
 * // Output:
 * // {
 * //   "id": 123,
 * //   "name": "John",
 * //   "roles": [
 * //     "admin",
 * //     "user"
 * //   ]
 * // }
 *
 * // Handling unserializable objects
 * const circularObj = {};
 * circularObj.self = circularObj;
 * console.log(formatObject(circularObj));
 * // Output: [Unserializable Object: object]
 */
export const formatObject = (obj: any): string => {
    try {
        return JSON.stringify(obj, null, 2);
    } catch (error) {
        return `[Unserializable Object: ${typeof obj}]`;
    }
};

/**
 * Logs state changes with detailed difference tracking
 *
 * This function is designed for React components to track and log changes in state variables.
 * It logs the previous and new state values and calculates the differences between them
 * for better debugging of component updates.
 *
 * @param {string} component - The component name
 * @param {string} stateName - The name of the state variable being tracked
 * @param {any} prevState - The previous state value
 * @param {any} newState - The new state value
 *
 * @example
 * // In a React component
 * useEffect(() => {
 *   // Log changes to userData state
 *   if (prevUserData) {
 *     logStateChange('UserProfile', 'userData', prevUserData, userData);
 *   }
 * }, [userData]);
 *
 * @example
 * // Output example for object state changes
 * // [STATE][UserProfile] userData changed:
 * // Previous: { name: "John", age: 30 }
 * // New: { name: "John", age: 31 }
 * // [STATE][DIFF] { age: { previous: 30, current: 31 } }
 */
export const logStateChange = (
    component: string,
    stateName: string,
    prevState: any,
    newState: any
) => {
    if (!DEBUG_MODE) return;

    console.log(`[STATE][${component}] ${stateName} changed:`);
    console.log('Previous:', prevState);
    console.log('New:', newState);

    // Log differences for objects
    if (typeof prevState === 'object' && prevState !== null &&
        typeof newState === 'object' && newState !== null) {
        try {
            const differences: Record<string, { previous: any; current: any }> = {};

            // Check for added or changed properties
            Object.keys(newState).forEach(key => {
                if (JSON.stringify(prevState[key]) !== JSON.stringify(newState[key])) {
                    differences[key] = {
                        previous: prevState[key],
                        current: newState[key]
                    };
                }
            });

            // Check for removed properties
            Object.keys(prevState).forEach(key => {
                if (!(key in newState)) {
                    differences[key] = {
                        previous: prevState[key],
                        current: undefined
                    };
                }
            });

            if (Object.keys(differences).length > 0) {
                console.log('[STATE][DIFF]', differences);
            }
        } catch (error) {
            console.error('Error calculating differences:', error);
        }
    }
};

/**
 * Verifies if an image URL is accessible and logs detailed diagnostics
 *
 * This function performs comprehensive checks on image URLs to help diagnose issues with
 * image loading in the application. It attempts multiple fetch strategies (HEAD, GET)
 * and logs detailed information about the responses.
 *
 * The function only executes when IMAGE_DEBUG_MODE is enabled.
 *
 * @param {string} source - The source component or event type that triggered the verification
 * @param {string} url - The image URL to verify
 * @param {Record<string, any>} [additionalInfo] - Optional additional context information to include in logs
 *
 * @example
 * // Basic usage
 * verifyImageUrl('TestResultComponent', 'https://example.com/images/screenshot.png');
 *
 * // With additional context information
 * verifyImageUrl('FrameEvent', imageUrl, {
 *   stepId: 'step-123',
 *   runId: 'run-456',
 *   eventType: 'frame'
 * });
 *
 * @remarks
 * This function performs the following checks:
 * 1. Attempts a HEAD request to quickly check if the URL is accessible
 * 2. If the HEAD request fails, attempts a GET request to get more information
 * 3. If the initial request fails completely, attempts a fallback GET request
 * 4. Logs detailed information about each request's outcome
 *
 * The function is designed to be non-blocking and will not throw exceptions.
 * All errors are caught and logged for diagnostic purposes.
 */
export const verifyImageUrl = (source: string, url: string, additionalInfo?: Record<string, any>) => {
    if (!IMAGE_DEBUG_MODE || !url) return;

    console.log(`[ImageDebug][${source}] Verifying image URL: ${url}`);

    // Try a HEAD request first to check if the URL is accessible
    fetch(url, {method: 'HEAD'})
        .then(response => {
            console.log(`[ImageDebug][${source}] Image URL HEAD check result:`, {
                url,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                ok: response.ok,
                timestamp: new Date().toISOString(),
                ...additionalInfo
            });

            // If HEAD request fails, try a GET request to get more information
            if (!response.ok) {
                return fetch(url)
                    .then(getResponse => getResponse.blob())
                    .then(blob => {
                        console.log(`[ImageDebug][${source}] Image GET request result:`, {
                            url,
                            blobSize: blob.size,
                            blobType: blob.type,
                            timestamp: new Date().toISOString(),
                            ...additionalInfo
                        });
                    });
            }
        })
        .catch(error => {
            console.error(`[ImageDebug][${source}] Error checking image URL:`, {
                url,
                error: error.message,
                timestamp: new Date().toISOString(),
                ...additionalInfo
            });

            // Try a full GET request as fallback
            fetch(url)
                .then(response => {
                    console.log(`[ImageDebug][${source}] Image GET fallback result:`, {
                        url,
                        status: response.status,
                        statusText: response.statusText,
                        headers: Object.fromEntries(response.headers.entries()),
                        ok: response.ok,
                        timestamp: new Date().toISOString(),
                        ...additionalInfo
                    });
                    return response.blob();
                })
                .then(blob => {
                    console.log(`[ImageDebug][${source}] Image blob received:`, {
                        url,
                        size: blob.size,
                        type: blob.type,
                        timestamp: new Date().toISOString(),
                        ...additionalInfo
                    });
                })
                .catch(fetchError => {
                    console.error(`[ImageDebug][${source}] Fetch error for image:`, {
                        url,
                        error: fetchError.message,
                        timestamp: new Date().toISOString(),
                        ...additionalInfo
                    });
                });
        });
};