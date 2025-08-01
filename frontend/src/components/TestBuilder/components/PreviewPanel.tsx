import React, { useState, useEffect } from 'react';
import { TestStatus, TestResult, Screenshot } from '../../../types';
import { debugLog, verifyImageUrl } from '../../../utils/debug';
import DebugPanel from './DebugPanel';

interface PreviewPanelProps {
  testStatus: TestStatus;
  selectedBrowser: string;
  onBrowserChange: (browser: string) => void;
  onRunTest: () => void;
  onPauseTest: () => void;
  currentUrl?: string;
  testResult?: TestResult | null;
  currentStepIndex?: number;
  onStepChange?: (index: number) => void;
}

const browsers = [
  { value: 'chrome', label: 'Chrome', icon: '🌐' },
  { value: 'firefox', label: 'Firefox', icon: '🦊' },
  { value: 'safari', label: 'Safari', icon: '🧭' },
  { value: 'edge', label: 'Edge', icon: '🌊' },
];

const statusConfig = {
  [TestStatus.PENDING]: { label: 'READY', color: '#6b7280', bgColor: '#f3f4f6' },
  [TestStatus.RUNNING]: { label: 'RUNNING', color: '#059669', bgColor: '#d1fae5' },
  [TestStatus.PASSED]: { label: 'PASSED', color: '#059669', bgColor: '#d1fae5' },
  [TestStatus.FAILED]: { label: 'FAILED', color: '#dc2626', bgColor: '#fee2e2' },
  [TestStatus.ERROR]: { label: 'ERROR', color: '#d97706', bgColor: '#fef3c7' },
};

const PreviewPanel: React.FC<PreviewPanelProps> = ({
  testStatus,
  selectedBrowser,
  onBrowserChange,
  onRunTest,
  onPauseTest,
  currentUrl,
  testResult,
  currentStepIndex = 0,
  onStepChange
}) => {
  PreviewPanel.displayName = 'PreviewPanel';
  // const normalizedStatus = testStatus?.toLowerCase() as TestStatus;
  // const status = statusConfig[testStatus];

  const status = statusConfig[testStatus];
  const [screenshotIndex, setScreenshotIndex] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  
  // Get screenshots for the current step
  const currentStepScreenshots: Screenshot[] = React.useMemo(() => {
    debugLog('PreviewPanel', `Calculating screenshots for step ${currentStepIndex}`);
    
    if (!testResult) {
      debugLog('PreviewPanel', 'No test result available');
      return [];
    }
    
    debugLog('PreviewPanel', 'Test result available', {
      id: testResult.id,
      status: testResult.status,
      stepResultsCount: testResult.stepResults?.length || 0
    });
    
    if (!testResult.stepResults || testResult.stepResults.length === 0) {
      debugLog('PreviewPanel', 'No step results available in test result');
      return [];
    }
    
    // If currentStepIndex is out of bounds, return empty array
    if (currentStepIndex >= testResult.stepResults.length) {
      debugLog('PreviewPanel', `Current step index out of bounds: ${currentStepIndex} >= ${testResult.stepResults.length}`);
      return [];
    }
    
    const stepResult = testResult.stepResults[currentStepIndex];
    debugLog('PreviewPanel', `Step result for index ${currentStepIndex}`, {
      stepId: stepResult.stepId,
      status: stepResult.status,
      screenshotsCount: stepResult.screenshots?.length || 0
    });
    
    const screenshots = stepResult.screenshots || [];
    
    if (screenshots.length > 0) {
      debugLog('PreviewPanel', `Found ${screenshots.length} screenshots for step ${currentStepIndex}`);
      debugLog('PreviewPanel', 'Screenshot details', screenshots.map(s => ({
        id: s.id,
        url: s.url,
        path: s.path
      })));
    } else {
      debugLog('PreviewPanel', `No screenshots found for step ${currentStepIndex}`);
    }
    
    return screenshots;
  }, [testResult, currentStepIndex]);
  
  // Reset screenshot index when step changes
  React.useEffect(() => {
    debugLog('PreviewPanel', `Step changed to ${currentStepIndex}, resetting screenshot index to 0`);
    setScreenshotIndex(0);
  }, [currentStepIndex]);
  
  // Proactively verify image URLs when screenshots change
  React.useEffect(() => {
    if (currentStepScreenshots.length > 0 && currentStepScreenshots[screenshotIndex]?.url) {
      debugLog('PreviewPanel', `Proactively verifying screenshot image at index ${screenshotIndex}`);
      verifyImageUrl('PreviewPanel-Proactive', currentStepScreenshots[screenshotIndex].url, {
        stepId: currentStepScreenshots[screenshotIndex].stepId,
        screenshotId: currentStepScreenshots[screenshotIndex].id,
        screenshotIndex,
        currentStepIndex,
        totalScreenshots: currentStepScreenshots.length
      });
    }
  }, [currentStepScreenshots, screenshotIndex]);
  
  // Log when component props change
  useEffect(() => {
    debugLog('PreviewPanel', 'Component props updated', {
      testStatus,
      selectedBrowser,
      currentUrl,
      currentStepIndex,
      testResultAvailable: !!testResult,
      screenshotsAvailable: currentStepScreenshots.length > 0
    });
  }, [testStatus, selectedBrowser, currentUrl, testResult, currentStepIndex, currentStepScreenshots.length]);
  
  // Handle navigation between screenshots
  const handlePrevScreenshot = () => {
    if (screenshotIndex > 0) {
      setScreenshotIndex(screenshotIndex - 1);
    }
  };
  
  const handleNextScreenshot = () => {
    if (screenshotIndex < currentStepScreenshots.length - 1) {
      setScreenshotIndex(screenshotIndex + 1);
    }
  };
  
  // Handle navigation between steps
  const handlePrevStep = () => {
    if (onStepChange && currentStepIndex > 0) {
      onStepChange(currentStepIndex - 1);
    }
  };
  
  const handleNextStep = () => {
    if (onStepChange && testResult && currentStepIndex < testResult.stepResults.length - 1) {
      onStepChange(currentStepIndex + 1);
    }
  };

  return (
    <div className="preview-panel">
      <div className="preview-header">
        <div className="preview-header-left">
          <div className="status-badge" style={{ 
            color: status.color, 
            backgroundColor: status.bgColor 
          }}>
            {status.label}
          </div>
          
          <select 
            value={selectedBrowser} 
            onChange={(e) => onBrowserChange(e.target.value)}
            className="browser-select"
          >
            {browsers.map(browser => (
              <option key={browser.value} value={browser.value}>
                {browser.icon} {browser.label}
              </option>
            ))}
          </select>
        </div>
        
        <div className="preview-controls">
          {testStatus === TestStatus.RUNNING ? (
            <button onClick={onPauseTest} className="control-button pause-button">
              <span className="control-icon">⏸</span>
              Pause
            </button>
          ) : (
            <>
              <button onClick={onRunTest} className="control-button run-button">
                <span className="control-icon">▶</span>
                Run
              </button>
              
              {/* Show Trace Viewer button after test completion */}
              {(testStatus === TestStatus.PASSED || testStatus === TestStatus.FAILED) && 
               testResult && testResult.traceUrl && (
                <a 
                  href={`https://trace.playwright.dev/?trace=${testResult.traceUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="control-button trace-button"
                >
                  <span className="control-icon">🔍</span>
                  Open Trace Viewer
                </a>
              )}
            </>
          )}
          
        </div>
      </div>
      
      <div className="preview-content">
        <div className="browser-mockup">
          <div className="browser-chrome">
            <div className="browser-controls">
              <div className="browser-dots">
                <div className="dot red"></div>
                <div className="dot yellow"></div>
                <div className="dot green"></div>
              </div>
              <div className="browser-url-bar">
                {currentUrl || 'about:blank'}
              </div>
              <button 
                onClick={() => setShowDebug(!showDebug)} 
                style={{
                  marginLeft: '8px',
                  padding: '2px 6px',
                  fontSize: '10px',
                  background: showDebug ? '#dc2626' : '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {showDebug ? 'Hide Debug' : 'Debug'}
              </button>
            </div>
          </div>
          
          <div className="browser-viewport">
            {/* Log rendering browser viewport */}
            {(() => { console.log('PreviewPanel: Rendering browser viewport, test status:', testStatus, 'screenshots:', currentStepScreenshots.length); return null; })()}
            {testStatus === TestStatus.RUNNING && !currentStepScreenshots.length ? (
              <div className="loading-state">
                {/* Log showing loading state */}
                {(() => { console.log('PreviewPanel: Showing loading state'); return null; })()}
                <div className="loading-spinner"></div>
                <p>Test is running...</p>
              </div>
            ) : currentStepScreenshots.length > 0 ? (
              <div className="screenshot-container">
                {/* Log showing screenshot */}
                {(() => { console.log('PreviewPanel: Showing screenshot at index', screenshotIndex, 'URL:', currentStepScreenshots[screenshotIndex].url); return null; })()}
                <img 
                  src={currentStepScreenshots[screenshotIndex].url} 
                  alt={`Screenshot ${screenshotIndex + 1} of step ${currentStepIndex + 1}`}
                  className="screenshot-image"
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement;
                    console.log('PreviewPanel: Screenshot image loaded successfully', {
                      url: currentStepScreenshots[screenshotIndex].url,
                      naturalWidth: img.naturalWidth,
                      naturalHeight: img.naturalHeight,
                      currentSrc: img.currentSrc,
                      complete: img.complete,
                      timestamp: new Date().toISOString()
                    });
                  }}
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    console.error('PreviewPanel: Error loading screenshot image:', {
                      url: currentStepScreenshots[screenshotIndex].url,
                      error: e,
                      currentSrc: img.currentSrc,
                      timestamp: new Date().toISOString()
                    });
                    
                    // Verify the image URL using our utility function
                    if (currentStepScreenshots[screenshotIndex].url) {
                      verifyImageUrl('PreviewPanel', currentStepScreenshots[screenshotIndex].url, {
                        stepId: currentStepScreenshots[screenshotIndex].stepId,
                        screenshotId: currentStepScreenshots[screenshotIndex].id,
                        screenshotIndex,
                        currentStepIndex,
                        errorEvent: 'onError'
                      });
                    }
                  }}
                />
                
                {/* Screenshot navigation */}
                {currentStepScreenshots.length > 1 && (
                  <div className="screenshot-navigation">
                    <button 
                      onClick={handlePrevScreenshot} 
                      disabled={screenshotIndex === 0}
                      className="nav-button"
                    >
                      ◀
                    </button>
                    <span className="screenshot-counter">
                      {screenshotIndex + 1} / {currentStepScreenshots.length}
                    </span>
                    <button 
                      onClick={handleNextScreenshot} 
                      disabled={screenshotIndex === currentStepScreenshots.length - 1}
                      className="nav-button"
                    >
                      ▶
                    </button>
                  </div>
                )}
                
                {/* Step navigation */}
                {testResult && testResult.stepResults.length > 1 && (
                  <div className="step-navigation">
                    <button 
                      onClick={handlePrevStep} 
                      disabled={currentStepIndex === 0}
                      className="step-nav-button"
                    >
                      ◀ Previous Step
                    </button>
                    <span className="step-counter">
                      Step {currentStepIndex + 1} / {testResult.stepResults.length}
                    </span>
                    <button 
                      onClick={handleNextStep} 
                      disabled={currentStepIndex === testResult.stepResults.length - 1}
                      className="step-nav-button"
                    >
                      Next Step ▶
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">🌐</div>
                <p>Browser preview will appear here</p>
                <p className="empty-subtitle">
                  Run your test to see the live preview
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Debug panels */}
      <DebugPanel 
        title="Test Result" 
        data={testResult} 
        show={showDebug} 
      />
      
      <DebugPanel 
        title="Current Step Screenshots" 
        data={{
          currentStepIndex,
          screenshotIndex,
          screenshots: currentStepScreenshots,
          currentScreenshot: currentStepScreenshots[screenshotIndex]
        }} 
        show={showDebug} 
      />
      
      <style>
        {`
          .preview-header-left {
            display: flex;
            align-items: center;
            gap: 16px;
          }
          
          .status-badge {
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.025em;
          }
          
          .browser-select {
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            background: white;
            font-size: 14px;
            cursor: pointer;
          }
          
          .browser-select:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }
          
          .preview-controls {
            display: flex;
            gap: 8px;
          }
          
          .control-button {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            background: white;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }
          
          .control-button:hover {
            background: #f9fafb;
            border-color: #9ca3af;
          }
          
          .control-icon {
            font-size: 14px;
          }
          
          .run-button {
            background: #10b981;
            color: white;
            border-color: #10b981;
          }
          
          .run-button:hover {
            background: #059669;
          }
          
          .pause-button {
            background: #f59e0b;
            color: white;
            border-color: #f59e0b;
          }
          
          .pause-button:hover {
            background: #d97706;
          }
          
          .trace-button {
            background: #4f46e5;
            color: white;
            border-color: #4f46e5;
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 6px;
            margin-left: 8px;
          }
          
          .trace-button:hover {
            background: #4338ca;
          }
          
          .reset-button:hover {
            background: #fee2e2;
            color: #dc2626;
            border-color: #fca5a5;
          }
          
          .browser-mockup {
            width: 100%;
            max-width: 1200px;
            height: 100%;
            max-height: 800px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          
          .browser-chrome {
            height: 48px;
            background: #f3f4f6;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            align-items: center;
            padding: 0 16px;
            flex-shrink: 0;
          }
          
          .browser-controls {
            display: flex;
            align-items: center;
            gap: 16px;
            width: 100%;
          }
          
          .browser-dots {
            display: flex;
            gap: 6px;
          }
          
          .dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
          }
          
          .dot.red { background: #ef4444; }
          .dot.yellow { background: #f59e0b; }
          .dot.green { background: #10b981; }
          
          .browser-url-bar {
            flex: 1;
            height: 32px;
            background: white;
            border: 1px solid #d1d5db;
            border-radius: 16px;
            display: flex;
            align-items: center;
            padding: 0 16px;
            font-size: 14px;
            color: #6b7280;
          }
          
          .browser-viewport {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fafafa;
          }
          
          .loading-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            color: #6b7280;
          }
          
          .loading-spinner {
            width: 32px;
            height: 32px;
            border: 3px solid #e5e7eb;
            border-top: 3px solid #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          
          .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            color: #9ca3af;
          }
          
          .empty-icon {
            font-size: 64px;
            margin-bottom: 16px;
            opacity: 0.5;
          }
          
          .empty-subtitle {
            font-size: 14px;
            margin-top: 4px;
          }
          
          .screenshot-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
            height: 100%;
            overflow: auto;
            position: relative;
          }
          
          .screenshot-image {
            max-width: 100%;
            max-height: calc(100% - 80px);
            object-fit: contain;
            border: 1px solid #e5e7eb;
          }
          
          .screenshot-navigation {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-top: 16px;
            gap: 12px;
          }
          
          .nav-button {
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 14px;
          }
          
          .nav-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          .nav-button:hover:not(:disabled) {
            background: #e5e7eb;
          }
          
          .screenshot-counter {
            font-size: 14px;
            color: #6b7280;
          }
          
          .step-navigation {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            margin-top: 16px;
            padding: 0 16px;
          }
          
          .step-nav-button {
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            padding: 6px 12px;
            cursor: pointer;
            font-size: 14px;
          }
          
          .step-nav-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          .step-nav-button:hover:not(:disabled) {
            background: #e5e7eb;
          }
          
          .step-counter {
            font-size: 14px;
            color: #6b7280;
          }
        `}
      </style>
    </div>
  );
};

export default PreviewPanel;