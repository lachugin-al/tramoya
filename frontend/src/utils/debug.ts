/**
 * Debug utility for logging and troubleshooting
 */

// Enable or disable debug mode
const DEBUG_MODE = true;

// Enable or disable image debugging
const IMAGE_DEBUG_MODE = true;

/**
 * Log a debug message to the console
 * @param component The component or module name
 * @param message The message to log
 * @param data Optional data to log
 */
export const debugLog = (component: string, message: string, data?: any) => {
  if (!DEBUG_MODE) return;
  
  console.log(`[DEBUG][${component}] ${message}`);
  if (data !== undefined) {
    console.log(`[DEBUG][${component}] Data:`, data);
  }
};

/**
 * Log an error message to the console
 * @param component The component or module name
 * @param message The error message
 * @param error Optional error object
 */
export const debugError = (component: string, message: string, error?: any) => {
  if (!DEBUG_MODE) return;
  
  console.error(`[ERROR][${component}] ${message}`);
  if (error !== undefined) {
    console.error(`[ERROR][${component}] Error:`, error);
  }
};

/**
 * Log a warning message to the console
 * @param component The component or module name
 * @param message The warning message
 * @param data Optional data to log
 */
export const debugWarn = (component: string, message: string, data?: any) => {
  if (!DEBUG_MODE) return;
  
  console.warn(`[WARN][${component}] ${message}`);
  if (data !== undefined) {
    console.warn(`[WARN][${component}] Data:`, data);
  }
};

/**
 * Format an object for logging
 * @param obj The object to format
 * @returns A formatted string representation of the object
 */
export const formatObject = (obj: any): string => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    return `[Unserializable Object: ${typeof obj}]`;
  }
};

/**
 * Log state changes
 * @param component The component name
 * @param stateName The name of the state variable
 * @param prevState The previous state
 * @param newState The new state
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
 * Verify if an image URL is accessible and log the results
 * @param source The source component or event type
 * @param url The image URL to verify
 * @param additionalInfo Optional additional information to include in logs
 */
export const verifyImageUrl = (source: string, url: string, additionalInfo?: Record<string, any>) => {
  if (!IMAGE_DEBUG_MODE || !url) return;
  
  console.log(`[ImageDebug][${source}] Verifying image URL: ${url}`);
  
  // Try a HEAD request first to check if the URL is accessible
  fetch(url, { method: 'HEAD' })
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