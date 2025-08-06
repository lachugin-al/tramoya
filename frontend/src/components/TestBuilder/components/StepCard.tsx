import React, {useRef, useState, useEffect} from 'react';
import {useDrag, useDrop, DropTargetMonitor} from 'react-dnd';
import {TestStep, TestStepType} from '../../../types';
import {StepIcons, StepLabels} from '../../../constants/stepTypeMetadata';

/**
 * Props for the StepCard component
 *
 * @interface StepCardProps
 * @property {TestStep} step - The test step data to display and edit
 * @property {number} index - The index of the step in the list
 * @property {boolean} [isEditing=false] - Whether the step is currently being edited
 * @property {function} onEdit - Callback function when the edit button is clicked
 * @property {function} onDelete - Callback function when the delete button is clicked
 * @property {function} onSave - Callback function when the step is saved
 * @property {function} onCancel - Callback function when editing is canceled
 * @property {function} [onMoveStep] - Callback function when the step is moved via drag and drop
 * @property {function} [onMoveUp] - Callback function when the step is moved up
 * @property {function} [onMoveDown] - Callback function when the step is moved down
 * @property {function} [onMouseEnter] - Callback function when the mouse enters the step card
 * @property {string} [status] - Step status (RUNNING, PASSED, FAILED, etc.)
 */
interface StepCardProps {
    step: TestStep;
    index: number;
    isEditing?: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onSave: (step: TestStep) => void;
    onCancel: () => void;
    onMoveStep?: (fromIndex: number, toIndex: number) => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onMouseEnter?: () => void;
    status?: string; // Step status (RUNNING, PASSED, FAILED, etc.)
}

/**
 * Interface for drag and drop item data
 *
 * @interface DragItem
 * @property {string} type - The type of the draggable item
 * @property {number} index - The index of the item in the list
 * @property {string} id - The unique identifier of the item
 */
interface DragItem {
    type: string;
    index: number;
    id: string;
}

/**
 * Interface for drop target collected props
 *
 * @interface DropCollectedProps
 * @property {string|symbol|null} handlerId - The handler ID for the drop target
 */
interface DropCollectedProps {
    handlerId: string | symbol | null;
}

/**
 * StepCard Component
 *
 * @component
 * @description Renders a single test step card with view and edit modes.
 * Supports drag and drop reordering, editing, and deletion of steps.
 * The component displays different fields based on the step type.
 *
 * @param {StepCardProps} props - Component props
 * @returns {JSX.Element} The rendered step card
 *
 * @example
 * ```tsx
 * <StepCard
 *   step={step}
 *   index={index}
 *   isEditing={isEditing}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 *   onSave={handleSave}
 *   onCancel={handleCancel}
 *   onMoveStep={handleMoveStep}
 * />
 * ```
 */
const StepCard: React.FC<StepCardProps> = ({
                                               step,
                                               index,
                                               isEditing = false,
                                               onEdit,
                                               onDelete,
                                               onSave,
                                               onCancel,
                                               onMoveStep,
                                               onMoveUp,
                                               onMoveDown,
                                               onMouseEnter,
                                               status
                                           }) => {
    // Create class name for step number with status
    // Default to "pending" status if no status is provided
    const stepNumberClass = `step-number ${status ? `status-${status}` : 'status-pending'}`;
    /**
     * Reference to the DOM element for drag and drop
     */
    const ref = useRef<HTMLDivElement>(null);

    /**
     * State for the editable copy of the step
     */
    const [editableStep, setEditableStep] = useState<TestStep>(step);

    /**
     * Effect to update the editable step when the props change
     */
    useEffect(() => {
        setEditableStep(step);
    }, [step, isEditing]);

    // Drag functionality
    const [{isDragging}, drag] = useDrag({
        type: 'STEP_CARD',
        canDrag: !isEditing,
        item: (): DragItem => ({
            type: 'STEP_CARD',
            index,
            id: step.id,
        }),
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    // Drop functionality
    const [{handlerId}, drop] = useDrop<DragItem, void, DropCollectedProps>({
        accept: 'STEP_CARD',
        collect: (monitor: DropTargetMonitor) => ({
            handlerId: monitor.getHandlerId(),
        }),
        hover: (item: DragItem, monitor: DropTargetMonitor) => {
            if (!ref.current || isEditing) {
                return;
            }
            const dragIndex = item.index;
            const hoverIndex = index;

            if (dragIndex === hoverIndex) {
                return;
            }

            const hoverBoundingRect = ref.current?.getBoundingClientRect();
            const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
            const clientOffset = monitor.getClientOffset();

            if (!clientOffset) {
                return;
            }

            const hoverClientY = clientOffset.y - hoverBoundingRect.top;

            if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
                return;
            }

            if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
                return;
            }

            if (onMoveStep) {
                onMoveStep(dragIndex, hoverIndex);
            }

            item.index = hoverIndex;
        },
    });

    // Combine drag and drop refs
    drag(drop(ref));

    const handleSave = () => {
        onSave(editableStep);
    };

    const handleFieldChange = (field: string, value: any) => {
        setEditableStep(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const getStepSummary = () => {
        const currentStep = isEditing ? editableStep : step;
        switch (currentStep.type) {
            case TestStepType.NAVIGATE:
                return (currentStep as any).url || 'Enter URL...';
            case TestStepType.INPUT:
                return `${(currentStep as any).selector || 'selector'}: "${(currentStep as any).text || 'text'}"`;
            case TestStepType.CLICK:
                return (currentStep as any).selector || 'Enter selector...';
            case TestStepType.ASSERT_TEXT:
                return `${(currentStep as any).selector || 'selector'}: "${(currentStep as any).text || 'text'}"`;
            case TestStepType.ASSERT_VISIBLE:
                return (currentStep as any).selector || 'Enter selector...';
            case TestStepType.WAIT:
                return `${(currentStep as any).milliseconds || 1000}ms`;
            case TestStepType.ASSERT_URL:
                return (currentStep as any).url || 'Enter URL...';
            case TestStepType.SCREENSHOT:
                return (currentStep as any).name || 'Screenshot';
            default:
                return '';
        }
    };

    const renderEditForm = () => {
        switch (editableStep.type) {
            case TestStepType.NAVIGATE:
                return (
                    <div className="edit-form">
                        <div className="form-field">
                            <label>URL:</label>
                            <input
                                type="text"
                                value={(editableStep as any).url || ''}
                                onChange={(e) => handleFieldChange('url', e.target.value)}
                                placeholder="https://example.com"
                            />
                        </div>
                        <div className="form-field">
                            <label>Description (optional):</label>
                            <input
                                type="text"
                                value={(editableStep as any).description || ''}
                                onChange={(e) => handleFieldChange('description', e.target.value)}
                                placeholder="Describe this step..."
                            />
                        </div>
                        <div className="form-field checkbox-field">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={(editableStep as any).takeScreenshot || false}
                                    onChange={(e) => handleFieldChange('takeScreenshot', e.target.checked)}
                                />
                                Take screenshot after this step
                            </label>
                        </div>
                    </div>
                );
            case TestStepType.INPUT:
                return (
                    <div className="edit-form">
                        <div className="form-field">
                            <label>Selector:</label>
                            <input
                                type="text"
                                value={(editableStep as any).selector || ''}
                                onChange={(e) => handleFieldChange('selector', e.target.value)}
                                placeholder="#username or .input-field"
                            />
                        </div>
                        <div className="form-field">
                            <label>Text:</label>
                            <input
                                type="text"
                                value={(editableStep as any).text || ''}
                                onChange={(e) => handleFieldChange('text', e.target.value)}
                                placeholder="Text to type..."
                            />
                        </div>
                        <div className="form-field">
                            <label>Description (optional):</label>
                            <input
                                type="text"
                                value={(editableStep as any).description || ''}
                                onChange={(e) => handleFieldChange('description', e.target.value)}
                                placeholder="Describe this step..."
                            />
                        </div>
                        <div className="form-field checkbox-field">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={(editableStep as any).takeScreenshot || false}
                                    onChange={(e) => handleFieldChange('takeScreenshot', e.target.checked)}
                                />
                                Take screenshot after this step
                            </label>
                        </div>
                    </div>
                );
            case TestStepType.CLICK:
                return (
                    <div className="edit-form">
                        <div className="form-field">
                            <label>Selector:</label>
                            <input
                                type="text"
                                value={(editableStep as any).selector || ''}
                                onChange={(e) => handleFieldChange('selector', e.target.value)}
                                placeholder="#button or .btn-submit"
                            />
                        </div>
                        <div className="form-field">
                            <label>Description (optional):</label>
                            <input
                                type="text"
                                value={(editableStep as any).description || ''}
                                onChange={(e) => handleFieldChange('description', e.target.value)}
                                placeholder="Describe this step..."
                            />
                        </div>
                        <div className="form-field checkbox-field">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={(editableStep as any).takeScreenshot || false}
                                    onChange={(e) => handleFieldChange('takeScreenshot', e.target.checked)}
                                />
                                Take screenshot after this step
                            </label>
                        </div>
                    </div>
                );
            case TestStepType.ASSERT_TEXT:
                return (
                    <div className="edit-form">
                        <div className="form-field">
                            <label>Selector:</label>
                            <input
                                type="text"
                                value={(editableStep as any).selector || ''}
                                onChange={(e) => handleFieldChange('selector', e.target.value)}
                                placeholder="#element or .text-content"
                            />
                        </div>
                        <div className="form-field">
                            <label>Expected text:</label>
                            <input
                                type="text"
                                value={(editableStep as any).text || ''}
                                onChange={(e) => handleFieldChange('text', e.target.value)}
                                placeholder="Text to assert..."
                            />
                        </div>
                        <div className="form-field checkbox-field">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={(editableStep as any).exactMatch || false}
                                    onChange={(e) => handleFieldChange('exactMatch', e.target.checked)}
                                />
                                Exact match
                            </label>
                        </div>
                        <div className="form-field">
                            <label>Description (optional):</label>
                            <input
                                type="text"
                                value={(editableStep as any).description || ''}
                                onChange={(e) => handleFieldChange('description', e.target.value)}
                                placeholder="Describe this step..."
                            />
                        </div>
                        <div className="form-field checkbox-field">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={(editableStep as any).takeScreenshot || false}
                                    onChange={(e) => handleFieldChange('takeScreenshot', e.target.checked)}
                                />
                                Take screenshot after this step
                            </label>
                        </div>
                    </div>
                );
            case TestStepType.ASSERT_VISIBLE:
                return (
                    <div className="edit-form">
                        <div className="form-field">
                            <label>Selector:</label>
                            <input
                                type="text"
                                value={(editableStep as any).selector || ''}
                                onChange={(e) => handleFieldChange('selector', e.target.value)}
                                placeholder="#element or .visible-content"
                            />
                        </div>
                        <div className="form-field checkbox-field">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={(editableStep as any).shouldBeVisible !== false}
                                    onChange={(e) => handleFieldChange('shouldBeVisible', e.target.checked)}
                                />
                                Element should be visible
                            </label>
                        </div>
                        <div className="form-field">
                            <label>Description (optional):</label>
                            <input
                                type="text"
                                value={(editableStep as any).description || ''}
                                onChange={(e) => handleFieldChange('description', e.target.value)}
                                placeholder="Describe this step..."
                            />
                        </div>
                        <div className="form-field checkbox-field">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={(editableStep as any).takeScreenshot || false}
                                    onChange={(e) => handleFieldChange('takeScreenshot', e.target.checked)}
                                />
                                Take screenshot after this step
                            </label>
                        </div>
                    </div>
                );
            case TestStepType.WAIT:
                return (
                    <div className="edit-form">
                        <div className="form-field">
                            <label>Wait time (milliseconds):</label>
                            <input
                                type="number"
                                value={(editableStep as any).milliseconds || 1000}
                                onChange={(e) => handleFieldChange('milliseconds', parseInt(e.target.value) || 1000)}
                                min="100"
                                max="30000"
                            />
                        </div>
                        <div className="form-field">
                            <label>Description (optional):</label>
                            <input
                                type="text"
                                value={(editableStep as any).description || ''}
                                onChange={(e) => handleFieldChange('description', e.target.value)}
                                placeholder="Describe this step..."
                            />
                        </div>
                        <div className="form-field checkbox-field">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={(editableStep as any).takeScreenshot || false}
                                    onChange={(e) => handleFieldChange('takeScreenshot', e.target.checked)}
                                />
                                Take screenshot after this step
                            </label>
                        </div>
                    </div>
                );
            case TestStepType.ASSERT_URL:
                return (
                    <div className="edit-form">
                        <div className="form-field">
                            <label>Expected URL:</label>
                            <input
                                type="text"
                                value={(editableStep as any).url || ''}
                                onChange={(e) => handleFieldChange('url', e.target.value)}
                                placeholder="https://example.com/expected-page"
                            />
                        </div>
                        <div className="form-field checkbox-field">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={(editableStep as any).exactMatch || false}
                                    onChange={(e) => handleFieldChange('exactMatch', e.target.checked)}
                                />
                                Exact match
                            </label>
                        </div>
                        <div className="form-field">
                            <label>Description (optional):</label>
                            <input
                                type="text"
                                value={(editableStep as any).description || ''}
                                onChange={(e) => handleFieldChange('description', e.target.value)}
                                placeholder="Describe this step..."
                            />
                        </div>
                        <div className="form-field checkbox-field">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={(editableStep as any).takeScreenshot || false}
                                    onChange={(e) => handleFieldChange('takeScreenshot', e.target.checked)}
                                />
                                Take screenshot after this step
                            </label>
                        </div>
                    </div>
                );
            case TestStepType.SCREENSHOT:
                return (
                    <div className="edit-form">
                        <div className="form-field">
                            <label>Screenshot name (optional):</label>
                            <input
                                type="text"
                                value={(editableStep as any).name || ''}
                                onChange={(e) => handleFieldChange('name', e.target.value)}
                                placeholder="Name for the screenshot"
                            />
                        </div>
                        <div className="form-field">
                            <label>Description (optional):</label>
                            <input
                                type="text"
                                value={(editableStep as any).description || ''}
                                onChange={(e) => handleFieldChange('description', e.target.value)}
                                placeholder="Describe this step..."
                            />
                        </div>
                    </div>
                );
            default:
                // Fallback for unknown step types - treat as any step with basic fields
                return (
                    <div className="edit-form">
                        <div className="form-field">
                            <label>Description (optional):</label>
                            <input
                                type="text"
                                value={(editableStep as any).description || ''}
                                onChange={(e) => handleFieldChange('description', e.target.value)}
                                placeholder="Describe this step..."
                            />
                        </div>
                        <div className="form-field checkbox-field">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={(editableStep as any).takeScreenshot || false}
                                    onChange={(e) => handleFieldChange('takeScreenshot', e.target.checked)}
                                />
                                Take screenshot after this step
                            </label>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div
            ref={ref}
            data-handler-id={handlerId}
            className={`step-card ${isDragging ? 'dragging' : ''} ${isEditing ? 'editing' : ''}`}
            onMouseEnter={onMouseEnter}
        >
            <div className={stepNumberClass}>{index + 1}</div>

            <div className="step-content">
                <div className="step-header">
                    <div className="step-type">
                        {!isEditing && <span className="drag-handle">⋮⋮</span>}
                        <span className="step-icon">{StepIcons[step.type]}</span>
                        <span className="step-label">{StepLabels[step.type]}</span>
                        {(step as any).takeScreenshot &&
                            <span className="screenshot-indicator" title="Screenshot enabled">📷</span>}
                    </div>

                    {!isEditing && (
                        <div className="step-actions">
                            {onMoveUp && (
                                <button onClick={onMoveUp} className="step-action-button" title="Move up">
                                    <span className="action-icon">↑</span>
                                </button>
                            )}
                            {onMoveDown && (
                                <button onClick={onMoveDown} className="step-action-button" title="Move down">
                                    <span className="action-icon">↓</span>
                                </button>
                            )}
                            <button onClick={onEdit} className="step-action-button" title="Edit">
                                <span className="action-icon">✏️</span>
                            </button>
                            <button onClick={onDelete} className="step-action-button delete-button" title="Delete">
                                <span className="action-icon">🗑️</span>
                            </button>
                        </div>
                    )}
                </div>

                {isEditing ? (
                    <>
                        {renderEditForm()}
                        <div className="edit-actions">
                            <button onClick={handleSave} className="save-button">
                                Save
                            </button>
                            <button onClick={onCancel} className="cancel-button">
                                Cancel
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="step-summary">{getStepSummary()}</div>
                        {(step as any).description && (
                            <div className="step-description">{(step as any).description}</div>
                        )}
                    </>
                )}
            </div>

            <style>
                {`
          .step-card {
            display: flex;
            gap: 12px;
            padding: 16px;
            margin-bottom: 8px;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            transition: all 0.2s;
            cursor: grab;
          }
          
          .step-card.editing {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            cursor: default;
          }
          
          .step-card:hover:not(.editing) {
            border-color: #d1d5db;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          
          .step-card.dragging {
            opacity: 0.5;
            transform: rotate(2deg);
            cursor: grabbing;
          }
          
          .step-number {
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f3f4f6;
            color: #6b7280;
            border-radius: 50%;
            font-size: 12px;
            font-weight: 600;
            flex-shrink: 0;
            transition: background-color 0.3s;
          }
          
          /* Status-specific styles */
          .step-number.status-running {
            animation: blink-animation 1s infinite alternate;
          }
          
          .step-number.status-passed {
            background: #f3f4f6;
            color: white;
          }
          
          .step-number.status-passed {
            background: #10b981;
            color: white;
          }
          
          .step-number.status-failed {
            background: #ef4444;
            color: white;
          }
          
          .step-number.status-error {
            background: #f59e0b;
            color: white;
          }
          
          .step-number.status-skipped {
            background: #6b7280;
            color: white;
          }
          
          @keyframes blink-animation {
            0% { background-color: #f3f4f6; }
            50% { background-color: #e0e0e0; }
            100% { background-color: #9ca3af; }
          }
          
          .step-content {
            flex: 1;
            min-width: 0;
          }
          
          .step-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          
          .step-type {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .drag-handle {
            color: #9ca3af;
            font-size: 12px;
            cursor: grab;
            padding: 2px;
          }
          
          .drag-handle:hover {
            color: #6b7280;
          }
          
          .step-card.dragging .drag-handle {
            cursor: grabbing;
          }
          
          .step-icon {
            font-size: 16px;
          }
          
          .step-label {
            font-size: 14px;
            font-weight: 500;
            color: #111827;
          }
          
          .screenshot-indicator {
            font-size: 12px;
            opacity: 0.7;
            margin-left: 4px;
          }
          
          .step-actions {
            display: flex;
            gap: 4px;
          }
          
          .step-action-button {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border: none;
            border-radius: 4px;
            background: transparent;
            color: #6b7280;
            cursor: pointer;
            transition: all 0.2s;
          }
          
          .step-action-button:hover {
            background: #f3f4f6;
            color: #374151;
          }
          
          .delete-button:hover {
            background: #fef2f2;
            color: #dc2626;
          }
          
          .action-icon {
            font-size: 14px;
          }
          
          .step-summary {
            font-size: 13px;
            color: #6b7280;
            margin-bottom: 4px;
            word-break: break-all;
          }
          
          .step-description {
            font-size: 12px;
            color: #9ca3af;
            font-style: italic;
          }
          
          .edit-form {
            margin-bottom: 16px;
          }
          
          .form-field {
            margin-bottom: 12px;
          }
          
          .form-field label {
            display: block;
            font-size: 12px;
            font-weight: 500;
            color: #374151;
            margin-bottom: 4px;
          }
          
          .form-field input[type="text"],
          .form-field input[type="number"] {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-size: 13px;
            transition: border-color 0.2s;
          }
          
          .form-field input[type="text"]:focus,
          .form-field input[type="number"]:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }
          
          .checkbox-field {
            margin-top: 8px;
          }
          
          .checkbox-label {
            display: flex !important;
            align-items: center;
            gap: 8px;
            font-size: 12px !important;
            font-weight: 400 !important;
            cursor: pointer;
            margin-bottom: 0 !important;
          }
          
          .checkbox-label input[type="checkbox"] {
            width: auto !important;
            margin: 0 !important;
            cursor: pointer;
          }
          
          .edit-actions {
            display: flex;
            gap: 8px;
          }
          
          .save-button {
            padding: 6px 12px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
          }
          
          .save-button:hover {
            background: #2563eb;
          }
          
          .cancel-button {
            padding: 6px 12px;
            background: #f3f4f6;
            color: #6b7280;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }
          
          .cancel-button:hover {
            background: #e5e7eb;
            color: #374151;
          }
        `}
            </style>
        </div>
    );
};

export default StepCard;