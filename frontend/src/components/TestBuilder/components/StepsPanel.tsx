import React, { useState } from 'react';
import {DndProvider} from 'react-dnd';
import {HTML5Backend} from 'react-dnd-html5-backend';
import {TestStep, TestStepType} from '../../../types';
import StepCard from './StepCard';

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

interface StepsPanelProps {
    steps: TestStep[];
    onEditStep: (index: number) => void;
    onDeleteStep: (index: number) => void;
    onMoveStep: (fromIndex: number, toIndex: number) => void;
    onAddStep: (stepType: TestStepType) => void;
    onUpdateStep: (index: number, step: TestStep) => void;
    editingStepIndex?: number;
}

const StepsPanel: React.FC<StepsPanelProps> = ({
                                                   steps,
                                                   onEditStep,
                                                   onDeleteStep,
                                                   onMoveStep,
                                                   onAddStep,
                                                   onUpdateStep,
                                                   editingStepIndex
                                               }) => {
    const [showAvailableSteps, setShowAvailableSteps] = useState(false);

    const handleSelectStepType = (stepType: TestStepType) => {
        onAddStep(stepType);
        setShowAvailableSteps(false);
    };

    const handleCancelEdit = () => {
        // Signal to parent to cancel editing
        onEditStep(-1);
    };

    const handleSaveStep = (index: number, updatedStep: TestStep) => {
        onUpdateStep(index, updatedStep);
        onEditStep(-1); // Exit editing mode
    };

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="steps-panel">
                <div className="steps-header">
                    <h3 className="steps-title">Test Steps</h3>
                    <div className="add-step-container">
                        <button
                            onClick={() => setShowAvailableSteps(!showAvailableSteps)}
                            className={`add-step-button ${showAvailableSteps ? 'active' : ''}`}
                            title="Add Step"
                        >
                            <span className="add-icon">+</span>
                        </button>

                        {showAvailableSteps && (
                            <div className="available-steps-dropdown">
                                <div className="available-steps-header-compact">
                                    <span>Available Steps</span>
                                </div>

                                <div className="available-steps-list">
                                    {StepTemplates.map((template) => (
                                        <div
                                            key={template.type}
                                            className="step-template compact"
                                            onClick={() => handleSelectStepType(template.type)}
                                        >
                                            <div className="step-template-icon">{template.icon}</div>
                                            <div className="step-template-content">
                                                <div className="step-template-label">{template.label}</div>
                                                <div className="step-template-description">{template.description}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="steps-content">
                    {steps.length === 0 ? (
                        <div className="empty-steps">
                            <div className="empty-icon">📝</div>
                            <p className="empty-text">No steps yet</p>
                            <p className="empty-subtitle">Click + to add your first step</p>
                        </div>
                    ) : (
                        <div className="steps-list">
                            {steps.map((step, index) => (
                                <StepCard
                                    key={step.id}
                                    step={step}
                                    index={index}
                                    isEditing={editingStepIndex === index}
                                    onEdit={() => onEditStep(index)}
                                    onDelete={() => onDeleteStep(index)}
                                    onSave={(updatedStep) => handleSaveStep(index, updatedStep)}
                                    onCancel={handleCancelEdit}
                                    onMoveStep={onMoveStep}
                                    onMoveUp={index > 0 ? () => onMoveStep(index, index - 1) : undefined}
                                    onMoveDown={index < steps.length - 1 ? () => onMoveStep(index, index + 1) : undefined}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <style>
                    {`
            .steps-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 20px 24px 16px;
              border-bottom: 1px solid #f3f4f6;
            }
            
            .steps-title {
              font-size: 16px;
              font-weight: 600;
              color: #111827;
              margin: 0;
            }
            
            .add-step-container {
              position: relative;
            }
            
            .add-step-button {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 32px;
              height: 32px;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              background: white;
              color: #6b7280;
              cursor: pointer;
              transition: all 0.2s;
            }
            
            .add-step-button:hover,
            .add-step-button.active {
              background: #f9fafb;
              color: #374151;
              border-color: #9ca3af;
            }
            
            .add-step-button.active {
              background: #3b82f6;
              color: white;
              border-color: #3b82f6;
            }
            
            .add-icon {
              font-size: 18px;
              font-weight: 500;
              transform: ${showAvailableSteps ? 'rotate(45deg)' : 'rotate(0deg)'};
              transition: transform 0.2s;
            }
            
            .available-steps-dropdown {
              position: absolute;
              top: 40px;
              right: 0;
              width: 280px;
              background: white;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
              z-index: 1000;
              max-height: 400px;
              overflow-y: auto;
            }
            
            .available-steps-header-compact {
              padding: 12px 16px 8px;
              font-size: 13px;
              font-weight: 600;
              color: #374151;
              border-bottom: 1px solid #f3f4f6;
            }
            
            .available-steps-list {
              padding: 0;
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
            
            .steps-content {
              flex: 1;
              overflow-y: auto;
            }
            
            .empty-steps {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 48px 24px;
              text-align: center;
            }
            
            .empty-icon {
              font-size: 48px;
              margin-bottom: 16px;
              opacity: 0.5;
            }
            
            .empty-text {
              font-size: 16px;
              font-weight: 500;
              color: #6b7280;
              margin: 0 0 4px;
            }
            
            .empty-subtitle {
              font-size: 14px;
              color: #9ca3af;
              margin: 0;
            }
            
            .steps-list {
              padding: 16px;
            }
          `}
                </style>
            </div>
        </DndProvider>
    );
};

export default StepsPanel;