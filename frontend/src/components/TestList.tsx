import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiService from '../services/api';
import { TestScenario } from '../types';

const TestList: React.FC = () => {
  const [tests, setTests] = useState<TestScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch tests on component mount
  useEffect(() => {
    fetchTests();
  }, []);

  // Fetch all tests from the API
  const fetchTests = async () => {
    try {
      setLoading(true);
      const data = await apiService.getTests();
      setTests(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching tests:', err);
      setError('Failed to load tests. Please try again.');
      toast.error('Failed to load tests');
    } finally {
      setLoading(false);
    }
  };


  // Delete a test
  const deleteTest = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this test?')) {
      return;
    }
    
    try {
      await apiService.deleteTest(id);
      setTests(tests.filter(test => test.id !== id));
      toast.success('Test deleted successfully');
    } catch (err) {
      console.error('Error deleting test:', err);
      toast.error('Failed to delete test');
    }
  };

  // Render loading state
  if (loading && tests.length === 0) {
    return (
      <div className="text-center py-10">
        <p>Loading tests...</p>
      </div>
    );
  }

  // Render error state
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

  // Render empty state
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

  // Render tests list
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