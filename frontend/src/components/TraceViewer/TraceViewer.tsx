import React, { useState, useEffect, useRef } from 'react';
import './TraceViewer.css';

/**
 * Props for the TraceViewer component
 * 
 * @interface TraceViewerProps
 * @property {string} traceId - The ID of the trace file to view
 * @property {boolean} [fullScreen=false] - Whether to display the trace viewer in full screen mode
 * @property {() => void} [onClose] - Callback function to call when the trace viewer is closed
 */
interface TraceViewerProps {
  traceId: string;
  fullScreen?: boolean;
  onClose?: () => void;
}

/**
 * TraceViewer Component
 * 
 * @component
 * @description Displays a Playwright trace file using the Playwright Trace Viewer.
 * The component handles starting a trace viewer session, displaying the trace viewer in an iframe,
 * and cleaning up the session when the component is unmounted.
 * 
 * @example
 * ```tsx
 * <TraceViewer traceId="run_123" onClose={() => setShowTraceViewer(false)} />
 * ```
 */
const TraceViewer: React.FC<TraceViewerProps> = ({ traceId, fullScreen = false, onClose }) => {
  // State for the trace viewer session
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Reference to the iframe element
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Start the trace viewer session when the component mounts
  useEffect(() => {
    const startTraceViewer = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Start the trace viewer session
        const response = await fetch(`/api/v1/trace-viewer/${traceId}/start`, {
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
        setSessionId(data.sessionId);
        setViewerUrl(data.url);
      } catch (err) {
        console.error('Error starting trace viewer:', err);
        setError(err instanceof Error ? err.message : 'Failed to start trace viewer');
      } finally {
        setLoading(false);
      }
    };
    
    startTraceViewer();
    
    // Clean up the trace viewer session when the component unmounts
    return () => {
      if (sessionId) {
        fetch(`/api/v1/trace-viewer/${sessionId}`, {
          method: 'DELETE'
        }).catch(err => {
          console.error('Error stopping trace viewer:', err);
        });
      }
    };
  }, [traceId]);
  
  // Handle iframe load event
  const handleIframeLoad = () => {
    setLoading(false);
  };
  
  // Handle close button click
  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };
  
  // Render loading state
  if (loading && !viewerUrl) {
    return (
      <div className={`trace-viewer-container ${fullScreen ? 'fullscreen' : ''}`}>
        <div className="trace-viewer-loading">
          <div className="spinner"></div>
          <p>Loading Trace Viewer...</p>
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className={`trace-viewer-container ${fullScreen ? 'fullscreen' : ''}`}>
        <div className="trace-viewer-error">
          <h3>Error Loading Trace Viewer</h3>
          <p>{error}</p>
          <button onClick={handleClose} className="close-button">Close</button>
        </div>
      </div>
    );
  }
  
  // Render the trace viewer
  return (
    <div className={`trace-viewer-container ${fullScreen ? 'fullscreen' : ''}`}>
      {onClose && (
        <button onClick={handleClose} className="close-button">
          ✕
        </button>
      )}
      
      {viewerUrl && (
        <div className="trace-viewer-iframe-container">
          {loading && (
            <div className="trace-viewer-loading overlay">
              <div className="spinner"></div>
              <p>Loading Trace Viewer...</p>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={viewerUrl}
            className="trace-viewer-iframe"
            onLoad={handleIframeLoad}
            title="Playwright Trace Viewer"
            allow="fullscreen"
          />
        </div>
      )}
    </div>
  );
};

export default TraceViewer;