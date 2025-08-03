import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiService from '../services/api';
import { TestScenario } from '../types';

/**
 * TestList Component
 * 
 * @component
 * @description Displays a list of all available test scenarios with options to create, edit, and delete tests.
 * The component handles various states including loading, error, and empty states.
 * 
 * @example
 * ```tsx
 * <TestList />
 * ```
 */
const TestList: React.FC = () => {
  /**
   * State containing the list of test scenarios
   */
  const [tests, setTests] = useState<TestScenario[]>([]);
  
  /**
   * State indicating whether tests are currently being loaded
   */
  const [loading, setLoading] = useState(true);
  
  /**
   * State containing error message if test loading fails
   */
  const [error, setError] = useState<string | null>(null);

  /**
   * Effect hook to fetch tests when component mounts
   */
  useEffect(() => {
    fetchTests();
  }, []);

  /**
   * Fetches all test scenarios from the API
   * 
   * @async
   * @function fetchTests
   * @description Retrieves all test scenarios from the backend API and updates component state
   * @returns {Promise<void>}
   */
  const fetchTests = async (): Promise<void> => {
    try {
      setLoading(true);
      const data = await apiService.getTests();
      setTests(data);
      setError(null);
    } catch (err) {
      setError('Failed to load tests. Please try again.');
      toast.error('Failed to load tests');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Deletes a test scenario
   * 
   * @async
   * @function deleteTest
   * @description Prompts for confirmation and deletes the specified test if confirmed
   * @param {string} id - The unique identifier of the test to delete
   * @returns {Promise<void>}
   */
  const deleteTest = async (id: string): Promise<void> => {
    if (!window.confirm('Are you sure you want to delete this test?')) {
      return;
    }
    
    try {
      await apiService.deleteTest(id);
      setTests(tests.filter(test => test.id !== id));
      toast.success('Test deleted successfully');
    } catch (err) {
      toast.error('Failed to delete test');
    }
  };

  /**
   * Renders loading state when tests are being fetched
   * @returns {JSX.Element} Loading indicator
   */
  if (loading && tests.length === 0) {
    return (
      <div className="text-center py-10">
        <p>Loading tests...</p>
      </div>
    );
  }

  /**
   * Renders error state when test fetching fails
   * @returns {JSX.Element} Error message with retry button
   */
  if (error && tests.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="alert alert-error">{error}</div>
        <button onClick={fetchTests} className="mt-4">
          Try Again
        </button>
      </div>
    );
  }

  /**
   * Renders empty state when no tests are available
   * @returns {JSX.Element} Empty state message with create test button
   */
  if (tests.length === 0) {
    return (
      <div className="text-center py-10">
        <h2 className="text-xl font-bold mb-4">No Tests Found</h2>
        <p className="mb-4">You haven't created any tests yet.</p>
        <Link to="/create" className="button">
          Create Your First Test
        </Link>
      </div>
    );
  }

  /**
   * Renders the list of test scenarios
   * @returns {JSX.Element} Grid layout of test cards with test details and action buttons
   */
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Your Tests</h2>
        <Link to="/create" className="button">
          Create New Test
        </Link>
      </div>

      <div className="grid gap-4">
        {tests.map(test => (
          <div key={test.id} className="card">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold">{test.name}</h3>
                {test.description && (
                  <p className="text-gray-600 mt-1">{test.description}</p>
                )}
                <div className="text-sm text-gray-500 mt-2">
                  <p>Created: {new Date(test.createdAt).toLocaleString()}</p>
                  <p>Steps: {test.steps.length}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link to={`/edit/${test.id}`} className="button bg-secondary">
                  Edit
                </Link>
                <button
                  onClick={() => deleteTest(test.id)}
                  className="button bg-error"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TestList;