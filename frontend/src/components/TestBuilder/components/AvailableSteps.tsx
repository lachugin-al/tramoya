
import React, { useState } from 'react';
import { TestStepType } from '../../../types';

/**
 * Template definitions for available test step types
 * 
 * @constant
 * @type {Array<{type: TestStepType, icon: string, label: string, description: string}>}
 * @description Array of step templates that users can add to their tests
 */
const StepTemplates = [
    { type: TestStepType.NAVIGATE, icon: '🌐', label: 'Navigate', description: 'Go to URL' },
    { type: TestStepType.INPUT, icon: '⌨️', label: 'Type text', description: 'Enter text in field' },
    { type: TestStepType.CLICK, icon: '🖱️', label: 'Click', description: 'Click element' },
    { type: TestStepType.ASSERT_TEXT, icon: '📝', label: 'Assert text', description: 'Check text content' },
    { type: TestStepType.ASSERT_VISIBLE, icon: '👁️', label: 'Assert visible', description: 'Check visibility' },
    { type: TestStepType.WAIT, icon: '⏱️', label: 'Wait', description: 'Pause execution' },
    { type: TestStepType.ASSERT_URL, icon: '🔗', label: 'Assert URL', description: 'Check current URL' },
    { type: TestStepType.SCREENSHOT, icon: '📷', label: 'Screenshot', description: 'Take screenshot' },
];

/**
 * Props for the AvailableSteps component
 * 
 * @interface AvailableStepsProps
 * @property {function} [onSelectStepType] - Callback function when a step type is selected
 * @property {boolean} [compact=false] - Whether to display the component in compact mode
 */
interface AvailableStepsProps {
    onSelectStepType?: (type: TestStepType) => void;
    compact?: boolean;
}

/**
 * AvailableSteps Component
 * 
 * @component
 * @description Displays a list of available test step types that users can add to their test.
 * The component can be displayed in two modes:
 * - Normal mode: A collapsible section with a toggle button
 * - Compact mode: A simple list of steps
 * 
 * @param {AvailableStepsProps} props - Component props
 * @returns {JSX.Element} The rendered component
 * 
 * @example
 * ```tsx
 * <AvailableSteps 
 *   onSelectStepType={handleStepTypeSelect}
 *   compact={false}
 * />
 * ```
 */
const AvailableSteps: React.FC<AvailableStepsProps> = ({ onSelectStepType, compact = false }) => {
    /**
     * State to track whether the list of steps is expanded or collapsed
     * Defaults to expanded in normal mode and collapsed in compact mode
     */
    const [expanded, setExpanded] = useState(!compact);

    /**
     * Handles selection of a step type
     * 
     * @function handleSelectStep
     * @param {TestStepType} type - The selected step type
     */
    const handleSelectStep = (type: TestStepType) => {
        if (onSelectStepType) {
            onSelectStepType(type);
        }
    };

    if (compact) {
        return (
            <div className="available-steps compact">
                <div className="available-steps-header-compact">
                    <span>Available Steps</span>
                </div>

                <div className="available-steps-list">
                    {StepTemplates.map((template) => (
                        <div
                            key={template.type}
                            className="step-template compact"
                            onClick={() => handleSelectStep(template.type)}
                        >
                            <div className="step-template-icon">{template.icon}</div>
                            <div className="step-template-content">
                                <div className="step-template-label">{template.label}</div>
                                <div className="step-template-description">{template.description}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <style>
                    {`
            .available-steps.compact {
              margin: 0;
              border: none;
            }
            
            .available-steps-header-compact {
              padding: 12px 16px 8px;
              font-size: 13px;
              font-weight: 600;
              color: #374151;
              border-bottom: 1px solid #f3f4f6;
            }
            
            .step-template.compact {
              display: flex;
              align-items: flex-start;
              gap: 12px;
              padding: 10px 16px;
              cursor: pointer;
              transition: background 0.2s;
              border-bottom: 1px solid #f9fafb;
            }
            
            .step-template.compact:hover {
              background: #f3f4f6;
            }
            
            .step-template.compact:last-child {
              border-bottom: none;
            }
            
            .step-template-icon {
              font-size: 16px;
              margin-top: 2px;
            }
            
            .step-template-content {
              flex: 1;
            }
            
            .step-template-label {
              font-size: 13px;
              font-weight: 500;
              color: #374151;
              margin-bottom: 2px;
            }
            
            .step-template-description {
              font-size: 11px;
              color: #9ca3af;
            }
          `}
                </style>
            </div>
        );
    }

    return (
        <div className="available-steps">
            <button
                onClick={() => setExpanded(!expanded)}
                className="available-steps-header"
            >
                <span className="toggle-icon">{expanded ? '▼' : '►'}</span>
                <span>Available Steps</span>
            </button>

            {expanded && (
                <div className="available-steps-list">
                    {StepTemplates.map((template) => (
                        <div
                            key={template.type}
                            className="step-template"
                            onClick={() => handleSelectStep(template.type)}
                        >
                            <div className="step-template-icon">{template.icon}</div>
                            <div className="step-template-content">
                                <div className="step-template-label">{template.label}</div>
                                <div className="step-template-description">{template.description}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style>
                {`
          .available-steps {
            margin-top: 24px;
            border-top: 1px solid #f3f4f6;
          }
          
          .available-steps-header {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            padding: 16px 24px;
            background: none;
            border: none;
            font-size: 14px;
            font-weight: 500;
            color: #6b7280;
            cursor: pointer;
            transition: color 0.2s;
          }
          
          .available-steps-header:hover {
            color: #374151;
          }
          
          .toggle-icon {
            font-size: 10px;
            width: 16px;
          }
          
          .available-steps-list {
            padding: 0 16px 16px;
          }
          
          .step-template {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 12px;
            margin-bottom: 4px;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.2s;
          }
          
          .step-template:hover {
            background: #f9fafb;
          }
          
          .step-template-icon {
            font-size: 16px;
            margin-top: 2px;
          }
          
          .step-template-content {
            flex: 1;
          }
          
          .step-template-label {
            font-size: 13px;
            font-weight: 500;
            color: #374151;
            margin-bottom: 2px;
          }
          
          .step-template-description {
            font-size: 12px;
            color: #9ca3af;
          }
        `}
            </style>
        </div>
    );
};

export default AvailableSteps;