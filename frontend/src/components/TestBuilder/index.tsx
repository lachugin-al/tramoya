
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';
import apiService from '../../services/api';
import useRunStream from '../../hooks/useRunStream';
import {
  TestScenario,
  TestStep,
  TestStepType,
  NavigateStep,
  InputStep,
  ClickStep,
  AssertTextStep,
  AssertVisibleStep,
  WaitStep,
  AssertUrlStep,
  ScreenshotStep,
  TestStatus
} from '../../types';
import TestBuilderLayout from './TestBuilderLayout';
import TestHeader from './components/TestHeader';
import StepsPanel from './components/StepsPanel';
import PreviewPanel from './components/PreviewPanel';

const TestBuilder: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  // State
  const [test, setTest] = useState<TestScenario>({
    id: '',
    name: '',
    description: '',
    createdAt: '',
    updatedAt: '',
    steps: [],
  });
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // New state for the updated UI
  const [testStatus, setTestStatus] = useState<TestStatus>(TestStatus.PENDING);
  const [selectedBrowser, setSelectedBrowser] = useState('chrome');
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  
  // Use the run stream hook for real-time updates
  const { 
    testResult 
    // Uncomment these if needed later:
    // loading: streamLoading, 
    // error: streamError, 
    // connected: streamConnected 
  } = useRunStream(currentRunId);

  // Fetch test if in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      fetchTest(id);
    }
  }, [isEditMode, id]);
  
  // Update test status when testResult changes
  useEffect(() => {
    if (testResult) {
      setTestStatus(testResult.status);
      
      // Update current URL if there's a navigate step
      if (testResult.stepResults.length > 0) {
        const stepId = testResult.stepResults[0].stepId;
        
        const step = test.steps.find(s => s.id === stepId);
        if (step && step.type === TestStepType.NAVIGATE) {
          setCurrentUrl((step as NavigateStep).url);
        }
      }
    }
  }, [testResult, test.steps]);

  // Fetch test from API
  const fetchTest = async (testId: string) => {
    try {
      setLoading(true);
      const data = await apiService.getTest(testId);
      setTest(data);
      setError(null);
    } catch (err) {
      setError('Failed to load test. Please try again.');
      toast.error('Failed to load test');
    } finally {
      setLoading(false);
    }
  };

  // Save test to API
  const saveTest = async () => {
    if (!test.name.trim()) {
      toast.error('Test name is required');
      return;
    }

    try {
      setSaving(true);

      if (isEditMode && id) {
        // Update existing test
        await apiService.updateTest(id, test);
        toast.success('Test updated successfully');
        // Stay on the edit page - no navigation
      } else {
        // Create new test
        const { id, createdAt, updatedAt, ...newTest } = test;
        const createdTest = await apiService.createTest(newTest);
        toast.success('Test created successfully');
        
        // Navigate to edit page for the newly created test
        navigate(`/edit/${createdTest.id}`);
      }
    } catch (err) {
      toast.error('Failed to save test');
    } finally {
      setSaving(false);
    }
  };

  // Fetch initial test result (only used for the first fetch)
  const fetchInitialTestResult = async (resultId: string) => {
    try {
      const result = await apiService.getTestResult(resultId);
      
      // Set the current run ID to start the SSE connection
      setCurrentRunId(resultId);
      
      // Update current URL if there's a navigate step
      if (result.stepResults.length > 0) {
        const stepId = result.stepResults[0].stepId;
        
        const step = test.steps.find(s => s.id === stepId);
        if (step && step.type === TestStepType.NAVIGATE) {
          setCurrentUrl((step as NavigateStep).url);
        }
      }
    } catch (err) {
      toast.error('Failed to fetch test result');
      setTestStatus(TestStatus.ERROR);
    }
  };

  // Run test
  const handleRunTest = async () => {
    if (!test.name.trim() || test.steps.length === 0) {
      toast.error('Test needs a name and at least one step');
      return;
    }

    try {
      // Reset state
      setTestStatus(TestStatus.RUNNING);
      setCurrentRunId(null); // Reset current run ID to close any existing SSE connection
      setCurrentStepIndex(0);

      // Execute test
      const { resultId } = await apiService.executeTest(test.id);

      // Fetch initial result and start SSE connection
      fetchInitialTestResult(resultId);

      // Update current URL if there's a navigate step
      if (test.steps.length > 0 && test.steps[0].type === TestStepType.NAVIGATE) {
        const url = (test.steps[0] as NavigateStep).url;
        setCurrentUrl(url);
      }
    } catch (err) {
      toast.error('Failed to execute test');
      setTestStatus(TestStatus.ERROR);
    }
  };

  // Pause test
  const handlePauseTest = () => {
    setTestStatus(TestStatus.PENDING);
    // Close the SSE connection by setting currentRunId to null
    setCurrentRunId(null);
    toast.info('Test paused');
  };


  // Handle editing a step
  const handleEditStep = (index: number) => {
    if (index === -1) {
      // Cancel editing
      setEditingIndex(null);
    } else {
      setEditingIndex(index);
    }
  };

  // Handle deleting a step
  const handleDeleteStep = (index: number) => {
    const newSteps = [...test.steps];
    newSteps.splice(index, 1);
    setTest({ ...test, steps: newSteps });

    // Cancel editing if we're deleting the step being edited
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  // Handle moving steps (drag and drop)
  const handleMoveStep = (fromIndex: number, toIndex: number) => {
    const newSteps = [...test.steps];
    const [movedStep] = newSteps.splice(fromIndex, 1);
    newSteps.splice(toIndex, 0, movedStep);
    setTest({ ...test, steps: newSteps });

    // Update editing index if necessary
    if (editingIndex === fromIndex) {
      setEditingIndex(toIndex);
    } else if (editingIndex !== null) {
      if (fromIndex < editingIndex && toIndex >= editingIndex) {
        setEditingIndex(editingIndex - 1);
      } else if (fromIndex > editingIndex && toIndex <= editingIndex) {
        setEditingIndex(editingIndex + 1);
      }
    }
  };

  // Handle adding a new step
  const handleAddStep = (stepType: TestStepType) => {
    const newStep = createStepTemplate(stepType);
    const newSteps = [...test.steps, newStep];
    setTest({ ...test, steps: newSteps });

    // Start editing the new step
    setEditingIndex(newSteps.length - 1);
  };

  // Create a step template with default values
  const createStepTemplate = (stepType: TestStepType): TestStep => {
    const baseStep = {
      id: uuidv4(),
      type: stepType,
      description: '',
    };

    switch (stepType) {
      case TestStepType.NAVIGATE:
        return {
          ...baseStep,
          url: '',
        } as NavigateStep;

      case TestStepType.INPUT:
        return {
          ...baseStep,
          selector: '',
          text: '',
        } as InputStep;

      case TestStepType.CLICK:
        return {
          ...baseStep,
          selector: '',
        } as ClickStep;

      case TestStepType.ASSERT_TEXT:
        return {
          ...baseStep,
          selector: '',
          text: '',
          exactMatch: false,
        } as AssertTextStep;

      case TestStepType.ASSERT_VISIBLE:
        return {
          ...baseStep,
          selector: '',
          shouldBeVisible: true,
        } as AssertVisibleStep;

      case TestStepType.WAIT:
        return {
          ...baseStep,
          milliseconds: 1000,
        } as WaitStep;

      case TestStepType.ASSERT_URL:
        return {
          ...baseStep,
          url: '',
          exactMatch: false,
        } as AssertUrlStep;

      case TestStepType.SCREENSHOT:
        return {
          ...baseStep,
          name: 'Screenshot',
        } as ScreenshotStep;

      default:
        return baseStep as TestStep;
    }
  };

  // Handle updating a step
  const handleUpdateStep = (index: number, updatedStep: TestStep) => {
    const newSteps = [...test.steps];
    newSteps[index] = updatedStep;
    setTest({ ...test, steps: newSteps });
    setEditingIndex(null); // Exit editing mode
  };

  // Handle test name change
  const handleTestNameChange = (name: string) => {
    setTest({ ...test, name });
  };

  // Render loading state
  if (loading) {
    return (
        <TestBuilderLayout>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%'
          }}>
            <div>Loading...</div>
          </div>
        </TestBuilderLayout>
    );
  }

  // Render error state
  if (error) {
    return (
        <TestBuilderLayout>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ color: '#dc2626' }}>{error}</div>
            <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '8px 16px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
            >
              Retry
            </button>
          </div>
        </TestBuilderLayout>
    );
  }

  return (
      <TestBuilderLayout>
        <div className="test-builder-header">
          <TestHeader
              testName={test.name}
              onTestNameChange={handleTestNameChange}
              onSave={saveTest}
              saving={saving}
          />
        </div>

        <div className="test-builder-content">
          <div className="steps-panel">
            <StepsPanel
                steps={test.steps}
                onEditStep={handleEditStep}
                onDeleteStep={handleDeleteStep}
                onMoveStep={handleMoveStep}
                onAddStep={handleAddStep}
                onUpdateStep={handleUpdateStep}
                editingStepIndex={editingIndex ?? undefined}
            />
          </div>

          <div className="preview-panel">
            <PreviewPanel
                testStatus={testStatus}
                selectedBrowser={selectedBrowser}
                onBrowserChange={setSelectedBrowser}
                onRunTest={handleRunTest}
                onPauseTest={handlePauseTest}
                currentUrl={currentUrl}
                testResult={testResult}
                currentStepIndex={currentStepIndex}
                onStepChange={setCurrentStepIndex}
            />
          </div>
        </div>
      </TestBuilderLayout>
  );
};

export default TestBuilder;