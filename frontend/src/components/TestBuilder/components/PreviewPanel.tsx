import React, { useState } from 'react';
import { TestStatus, TestResult, Screenshot } from '../../../types';

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
  const status = statusConfig[testStatus];
  const [screenshotIndex, setScreenshotIndex] = useState(0);
  
  // Get screenshots for the current step
  const currentStepScreenshots: Screenshot[] = React.useMemo(() => {
    if (!testResult || !testResult.stepResults || testResult.stepResults.length === 0) {
      return [];
    }
    
    // If currentStepIndex is out of bounds, return empty array
    if (currentStepIndex >= testResult.stepResults.length) {
      return [];
    }
    
    return testResult.stepResults[currentStepIndex].screenshots || [];
  }, [testResult, currentStepIndex]);
  
  // Reset screenshot index when step changes
  React.useEffect(() => {
    setScreenshotIndex(0);
  }, [currentStepIndex]);
  
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
            <button onClick={onRunTest} className="control-button run-button">
              <span className="control-icon">▶</span>
              Run
            </button>
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
            </div>
          </div>
          
          <div className="browser-viewport">
            {testStatus === TestStatus.RUNNING && !currentStepScreenshots.length ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Test is running...</p>
              </div>
            ) : currentStepScreenshots.length > 0 ? (
              <div className="screenshot-container">
                <img 
                  src={currentStepScreenshots[screenshotIndex].url} 
                  alt={`Screenshot ${screenshotIndex + 1} of step ${currentStepIndex + 1}`}
                  className="screenshot-image"
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