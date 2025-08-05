import { useState, useEffect, useCallback } from 'react';

/**
 * Interface for trace viewer session information
 */
interface TraceViewerSession {
  sessionId: string;
  port: number;
  url: string;
  status: string;
}

/**
 * Interface for trace viewer status information
 */
interface TraceViewerStatus {
  status: string;
  uptime: number;
  lastAccess: string;
}

/**
 * Hook for managing Playwright Trace Viewer sessions
 * 
 * @param {string | null} traceId - The ID of the trace file to view, or null if no trace is selected
 * @returns {Object} Object containing trace viewer session state and control functions
 * @returns {boolean} returns.loading - Whether the trace viewer is currently loading
 * @returns {string | null} returns.error - Error message if there was an error, or null if no error
 * @returns {TraceViewerSession | null} returns.session - The trace viewer session information, or null if no session
 * @returns {Function} returns.startSession - Function to start a trace viewer session
 * @returns {Function} returns.stopSession - Function to stop the current trace viewer session
 * @returns {Function} returns.refreshStatus - Function to refresh the status of the current session
 */
export function useTraceViewer(traceId: string | null) {
  // State for the trace viewer session
  const [session, setSession] = useState<TraceViewerSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  /**
   * Starts a trace viewer session for the specified trace ID
   * 
   * @param {string} id - The ID of the trace file to view
   * @returns {Promise<TraceViewerSession | null>} The trace viewer session information, or null if there was an error
   */
  const startSession = useCallback(async (id: string): Promise<TraceViewerSession | null> => {
    if (!id) {
      setError('No trace ID provided');
      return null;
    }
  
    try {
      setLoading(true);
      setError(null);
    
      // Start the trace viewer session
      const response = await fetch(`/api/v1/trace-viewer/${id}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start trace viewer');
      }
    
      const data = await response.json();
      setSession(data);
      return data;
    } catch (err) {
      console.error('Error starting trace viewer:', err);
      setError(err instanceof Error ? err.message : 'Failed to start trace viewer');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Starts a trace viewer session for the specified trace URL
   * 
   * @param {string} url - The URL of the trace file to view
   * @returns {Promise<TraceViewerSession | null>} The trace viewer session information, or null if there was an error
   */
  const startSessionByUrl = useCallback(async (url: string): Promise<TraceViewerSession | null> => {
    if (!url) {
      setError('No trace URL provided');
      return null;
    }
  
    try {
      setLoading(true);
      setError(null);
    
      // Start the trace viewer session using the new API endpoint
      const response = await fetch(`/api/v1/trace-viewer/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ traceUrl: url })
      });
    
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start trace viewer');
      }
    
      const data = await response.json();
      setSession(data);
      return data;
    } catch (err) {
      console.error('Error starting trace viewer:', err);
      setError(err instanceof Error ? err.message : 'Failed to start trace viewer');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  
  /**
   * Stops the current trace viewer session
   * 
   * @returns {Promise<boolean>} Whether the session was successfully stopped
   */
  const stopSession = useCallback(async (): Promise<boolean> => {
    if (!session) {
      return false;
    }
    
    try {
      setLoading(true);
      
      // Stop the trace viewer session
      const response = await fetch(`/api/v1/trace-viewer/${session.sessionId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to stop trace viewer');
      }
      
      setSession(null);
      return true;
    } catch (err) {
      console.error('Error stopping trace viewer:', err);
      setError(err instanceof Error ? err.message : 'Failed to stop trace viewer');
      return false;
    } finally {
      setLoading(false);
    }
  }, [session]);
  
  /**
   * Refreshes the status of the current trace viewer session
   * 
   * @returns {Promise<TraceViewerStatus | null>} The trace viewer status information, or null if there was an error
   */
  const refreshStatus = useCallback(async (): Promise<TraceViewerStatus | null> => {
    if (!session) {
      return null;
    }
    
    try {
      // Get the session status
      const response = await fetch(`/api/v1/trace-viewer/${session.sessionId}/status`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get trace viewer status');
      }
      
      return await response.json();
    } catch (err) {
      console.error('Error getting trace viewer status:', err);
      return null;
    }
  }, [session]);
  
  // Start a session when traceId changes
  useEffect(() => {
    if (traceId) {
      startSession(traceId);
    } else {
      // If traceId is null, stop any existing session
      if (session) {
        stopSession();
      }
    }
    
    // Clean up the session when the component unmounts or traceId changes
    return () => {
      if (session) {
        fetch(`/api/v1/trace-viewer/${session.sessionId}`, {
          method: 'DELETE'
        }).catch(err => {
          console.error('Error stopping trace viewer during cleanup:', err);
        });
      }
    };
  }, [traceId]);
  
  return {
    loading,
    error,
    session,
    startSession,
    startSessionByUrl,
    stopSession,
    refreshStatus
  };
}

export default useTraceViewer;