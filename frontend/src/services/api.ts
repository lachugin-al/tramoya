import axios from 'axios';
import { TestScenario, TestResult } from '../types';

// Create axios instance with base URL
const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * API service for communicating with the backend
 */
export const apiService = {
  /**
   * Get all test scenarios
   */
  async getTests(): Promise<TestScenario[]> {
    const response = await api.get('/tests');
    return response.data;
  },

  /**
   * Get a specific test scenario by ID
   */
  async getTest(id: string): Promise<TestScenario> {
    const response = await api.get(`/tests/${id}`);
    return response.data;
  },

  /**
   * Create a new test scenario
   */
  async createTest(test: Omit<TestScenario, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestScenario> {
    const response = await api.post('/tests', test);
    return response.data;
  },

  /**
   * Update an existing test scenario
   */
  async updateTest(id: string, test: Partial<TestScenario>): Promise<TestScenario> {
    const response = await api.put(`/tests/${id}`, test);
    return response.data;
  },

  /**
   * Delete a test scenario
   */
  async deleteTest(id: string): Promise<void> {
    await api.delete(`/tests/${id}`);
  },

  /**
   * Execute a test scenario
   */
  async executeTest(id: string): Promise<{ resultId: string; result: TestResult }> {
    console.log('API Service: Executing test with ID:', id);
    try {
      const response = await api.post(`/tests/${id}/execute`);
      console.log('API Service: Test execution response:', response.data);
      return response.data;
    } catch (error) {
      console.error('API Service: Error executing test:', error);
      throw error;
    }
  },

  /**
   * Get all test results
   */
  async getTestResults(): Promise<TestResult[]> {
    const response = await api.get('/tests/results');
    return response.data;
  },

  /**
   * Get a specific test result by ID
   */
  async getTestResult(id: string): Promise<TestResult> {
    console.log('API Service: Getting test result with ID:', id);
    try {
      const response = await api.get(`/tests/results/${id}`);
      console.log('API Service: Test result response:', response.data);
      
      // Log details about screenshots in the response
      if (response.data && response.data.stepResults) {
        const screenshotCount = response.data.stepResults.reduce(
          (count: number, step: any) => count + (step.screenshots ? step.screenshots.length : 0), 0
        );
        console.log(`API Service: Result contains ${response.data.stepResults.length} steps with ${screenshotCount} total screenshots`);
      }
      
      return response.data;
    } catch (error) {
      console.error('API Service: Error getting test result:', error);
      throw error;
    }
  },

  /**
   * Get all results for a specific test
   */
  async getResultsForTest(testId: string): Promise<TestResult[]> {
    const response = await api.get(`/tests/${testId}/results`);
    return response.data;
  },

  /**
   * Delete a test result
   */
  async deleteTestResult(id: string): Promise<void> {
    await api.delete(`/tests/results/${id}`);
  },
};

export default apiService;