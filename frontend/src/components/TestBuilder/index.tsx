
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';
import apiService from '../../services/api';
import useRunStream from '../../hooks/useRunStream';
import { createLogger } from '../../utils/logger';
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

// Create logger for TestBuilder component
const logger = createLogger('test-builder');

const TestBuilder: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  // Log component initialization
  logger.info('TestBuilder component initialized', { 
    isEditMode, 
    testId: id 
  });

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
  } = useRunStream(currentRunId, null, test.id);

  // Fetch test if in edit mode
  useEffect(() => {
    logger.debug('TestBuilder useEffect - fetch test', { isEditMode, id });
    if (isEditMode && id) {
      fetchTest(id);
    } else {
      logger.info('Creating new test scenario');
    }
    
    // Cleanup function
    return () => {
      logger.debug('TestBuilder component unmounting');
    };
  }, [isEditMode, id]);
  
  // Update test status when testResult changes
  useEffect(() => {
    if (testResult) {
      logger.debug('Test result updated', { 
        runId: testResult.id,
        status: testResult.status,
        stepsCount: testResult.stepResults.length
      });
      
      setTestStatus(testResult.status);
      
      // Update current URL if there's a navigate step
      if (testResult.stepResults.length > 0) {
        const stepId = testResult.stepResults[0].stepId;
        
        const step = test.steps.find(s => s.id === stepId);
        if (step && step.type === TestStepType.NAVIGATE) {
          const url = (step as NavigateStep).url;
          logger.debug('Updating current URL', { url });
          setCurrentUrl(url);
        }
      }
    }
  }, [testResult, test.steps]);

  // Fetch test from API
  const fetchTest = async (testId: string) => {
    logger.info(`Fetching test: ${testId}`);
    const startTime = Date.now();
    
    try {
      setLoading(true);
      const data = await apiService.getTest(testId);
      
      logger.info(`Test fetched successfully: ${testId}`, {
        name: data.name,
        stepsCount: data.steps.length,
        fetchTime: `${Date.now() - startTime}ms`
      });
      
      setTest(data);
      setError(null);
    } catch (err) {
      logger.error(`Failed to load test: ${testId}`, { error: err });
      setError('Failed to load test. Please try again.');
      toast.error('Failed to load test');
    } finally {
      setLoading(false);
    }
  };

  // Save test to API
  const saveTest = async () => {
    if (!test.name.trim()) {
      logger.warn('Attempted to save test with empty name');
      toast.error('Test name is required');
      return;
    }

    logger.info('Saving test', {
      id: test.id,
      name: test.name,
      stepsCount: test.steps.length,
      isEditMode
    });
    
    const startTime = Date.now();
    
    try {
      setSaving(true);

      if (isEditMode && id) {
        // Update existing test
        logger.debug(`Updating existing test: ${id}`);
        await apiService.updateTest(id, test);
        logger.info(`Test updated successfully: ${id}`, {
          saveTime: `${Date.now() - startTime}ms`
        });
        toast.success('Test updated successfully');
        // Stay on the edit page - no navigation
      } else {
        // Create new test
        logger.debug('Creating new test');
        const { id, createdAt, updatedAt, ...newTest } = test;
        const createdTest = await apiService.createTest(newTest);
        logger.info(`Test created successfully: ${createdTest.id}`, {
          saveTime: `${Date.now() - startTime}ms`
        });
        toast.success('Test created successfully');
        
        // Navigate to edit page for the newly created test
        navigate(`/edit/${createdTest.id}`);
      }
    } catch (err) {
      logger.error('Failed to save test', { 
        error: err,
        testId: test.id,
        saveTime: `${Date.now() - startTime}ms`
      });
      toast.error('Failed to save test');
    } finally {
      setSaving(false);
    }
  };

  // Fetch initial test result (only used for the first fetch)
  const fetchInitialTestResult = async (resultId: string) => {
    logger.info(`Fetching initial test result: ${resultId}`);
    const startTime = Date.now();
    
    try {
      const result = await apiService.getTestResult(resultId);
      
      logger.info(`Initial test result fetched: ${resultId}`, {
        status: result.status,
        stepsCount: result.stepResults.length,
        fetchTime: `${Date.now() - startTime}ms`
      });
      
      // Set the current run ID to start the SSE connection
      setCurrentRunId(resultId);
      
      // Update current URL if there's a navigate step
      if (result.stepResults.length > 0) {
        const stepId = result.stepResults[0].stepId;
        
        const step = test.steps.find(s => s.id === stepId);
        if (step && step.type === TestStepType.NAVIGATE) {
          const url = (step as NavigateStep).url;
          logger.debug(`Setting current URL: ${url}`);
          setCurrentUrl(url);
        }
      }
    } catch (err) {
      logger.error(`Failed to fetch initial test result: ${resultId}`, {
        error: err,
        fetchTime: `${Date.now() - startTime}ms`
      });
      toast.error('Failed to fetch test result');
      setTestStatus(TestStatus.ERROR);
    }
  };

  // Run test
  const handleRunTest = async () => {
    if (!test.name.trim() || test.steps.length === 0) {
      logger.warn('Attempted to run test without name or steps', {
        name: test.name,
        stepsCount: test.steps.length
      });
      toast.error('Test needs a name and at least one step');
      return;
    }

    logger.info(`Running test: ${test.id}`, {
      name: test.name,
      stepsCount: test.steps.length
    });
    
    const startTime = Date.now();
    
    try {
      // Reset state
      logger.debug('Resetting test state');
      setTestStatus(TestStatus.RUNNING);
      setCurrentRunId(null); // Reset current run ID to close any existing SSE connection
      setCurrentStepIndex(0);

      // Execute test
      logger.debug(`Executing test: ${test.id}`);
      const { resultId } = await apiService.executeTest(test.id);
      logger.info(`Test execution started: ${test.id}`, {
        resultId,
        executionTime: `${Date.now() - startTime}ms`
      });

      // Fetch initial result and start SSE connection
      fetchInitialTestResult(resultId);

      // Update current URL if there's a navigate step
      if (test.steps.length > 0 && test.steps[0].type === TestStepType.NAVIGATE) {
        const url = (test.steps[0] as NavigateStep).url;
        logger.debug(`Setting initial URL: ${url}`);
        setCurrentUrl(url);
      }
    } catch (err) {
      logger.error(`Failed to execute test: ${test.id}`, {
        error: err,
        executionTime: `${Date.now() - startTime}ms`
      });
      toast.error('Failed to execute test');
      setTestStatus(TestStatus.ERROR);
    }
  };

  // Pause test
  const handlePauseTest = () => {
    logger.info('Pausing test', {
      testId: test.id,
      runId: currentRunId
    });
    
    setTestStatus(TestStatus.PENDING);
    // Close the SSE connection by setting currentRunId to null
    setCurrentRunId(null);
    toast.info('Test paused');
  };


  // Handle editing a step
  const handleEditStep = (index: number) => {
    if (index === -1) {
      // Cancel editing
      logger.debug('Canceling step editing');
      setEditingIndex(null);
    } else {
      const step = test.steps[index];
      logger.info(`Editing step at index ${index}`, {
        stepId: step.id,
        stepType: step.type,
        description: step.description
      });
      setEditingIndex(index);
    }
  };

  // Handle deleting a step
  const handleDeleteStep = (index: number) => {
    const stepToDelete = test.steps[index];
    logger.info(`Deleting step at index ${index}`, {
      stepId: stepToDelete.id,
      stepType: stepToDelete.type,
      description: stepToDelete.description
    });
    
    const newSteps = [...test.steps];
    newSteps.splice(index, 1);
    setTest({ ...test, steps: newSteps });

    // Cancel editing if we're deleting the step being edited
    if (editingIndex === index) {
      logger.debug('Canceling editing mode after step deletion');
      setEditingIndex(null);
    }
    
    logger.debug(`Test now has ${newSteps.length} steps`);
  };

  // Handle moving steps (drag and drop)
  const handleMoveStep = (fromIndex: number, toIndex: number) => {
    const stepToMove = test.steps[fromIndex];
    logger.info(`Moving step from index ${fromIndex} to ${toIndex}`, {
      stepId: stepToMove.id,
      stepType: stepToMove.type,
      description: stepToMove.description
    });
    
    const newSteps = [...test.steps];
    const [movedStep] = newSteps.splice(fromIndex, 1);
    newSteps.splice(toIndex, 0, movedStep);
    setTest({ ...test, steps: newSteps });

    // Update editing index if necessary
    if (editingIndex === fromIndex) {
      logger.debug(`Updating editing index from ${editingIndex} to ${toIndex}`);
      setEditingIndex(toIndex);
    } else if (editingIndex !== null) {
      if (fromIndex < editingIndex && toIndex >= editingIndex) {
        logger.debug(`Updating editing index from ${editingIndex} to ${editingIndex - 1}`);
        setEditingIndex(editingIndex - 1);
      } else if (fromIndex > editingIndex && toIndex <= editingIndex) {
        logger.debug(`Updating editing index from ${editingIndex} to ${editingIndex + 1}`);
        setEditingIndex(editingIndex + 1);
      }
    }
  };

  // Handle adding a new step
  const handleAddStep = (stepType: TestStepType) => {
    logger.info(`Adding new step of type ${stepType}`);
    
    const newStep = createStepTemplate(stepType);
    const newSteps = [...test.steps, newStep];
    setTest({ ...test, steps: newSteps });

    // Start editing the new step
    const newIndex = newSteps.length - 1;
    logger.debug(`Starting to edit new step at index ${newIndex}`, {
      stepId: newStep.id,
      stepType: newStep.type
    });
    setEditingIndex(newIndex);
  };

  // Create a step template with default values
  const createStepTemplate = (stepType: TestStepType): TestStep => {
    logger.debug(`Creating step template for type ${stepType}`);
    
    const stepId = uuidv4();
    const baseStep = {
      id: stepId,
      type: stepType,
      description: '',
    };

    let result: TestStep;
    
    switch (stepType) {
      case TestStepType.NAVIGATE:
        result = {
          ...baseStep,
          url: '',
        } as NavigateStep;
        break;

      case TestStepType.INPUT:
        result = {
          ...baseStep,
          selector: '',
          text: '',
        } as InputStep;
        break;

      case TestStepType.CLICK:
        result = {
          ...baseStep,
          selector: '',
        } as ClickStep;
        break;

      case TestStepType.ASSERT_TEXT:
        result = {
          ...baseStep,
          selector: '',
          text: '',
          exactMatch: false,
        } as AssertTextStep;
        break;

      case TestStepType.ASSERT_VISIBLE:
        result = {
          ...baseStep,
          selector: '',
          shouldBeVisible: true,
        } as AssertVisibleStep;
        break;

      case TestStepType.WAIT:
        result = {
          ...baseStep,
          milliseconds: 1000,
        } as WaitStep;
        break;

      case TestStepType.ASSERT_URL:
        result = {
          ...baseStep,
          url: '',
          exactMatch: false,
        } as AssertUrlStep;
        break;

      case TestStepType.SCREENSHOT:
        result = {
          ...baseStep,
          name: 'Screenshot',
        } as ScreenshotStep;
        break;

      default:
        result = baseStep as TestStep;
        break;
    }
    
    logger.debug(`Created step template with ID ${stepId}`, { 
      stepType, 
      stepId 
    });
    
    return result;
  };

  // Handle updating a step
  const handleUpdateStep = (index: number, updatedStep: TestStep) => {
    const originalStep = test.steps[index];
    logger.info(`Updating step at index ${index}`, {
      stepId: updatedStep.id,
      stepType: updatedStep.type,
      description: updatedStep.description,
      changes: JSON.stringify(getDifferences(originalStep, updatedStep))
    });
    
    const newSteps = [...test.steps];
    newSteps[index] = updatedStep;
    setTest({ ...test, steps: newSteps });
    
    logger.debug('Exiting editing mode');
    setEditingIndex(null); // Exit editing mode
  };
  
  // Helper function to get differences between objects for logging
  const getDifferences = (original: any, updated: any): Record<string, { from: any, to: any }> => {
    const differences: Record<string, { from: any, to: any }> = {};
    
    // Get all keys from both objects
    const allKeys = new Set([...Object.keys(original), ...Object.keys(updated)]);
    
    // Check each key for differences
    allKeys.forEach(key => {
      if (JSON.stringify(original[key]) !== JSON.stringify(updated[key])) {
        differences[key] = {
          from: original[key],
          to: updated[key]
        };
      }
    });
    
    return differences;
  };

  // Handle test name change
  const handleTestNameChange = (name: string) => {
    logger.debug(`Updating test name from "${test.name}" to "${name}"`);
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