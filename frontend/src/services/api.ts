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
    const response = await api.post(`/tests/${id}/execute`);
    return response.data;
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
    const response = await api.get(`/tests/results/${id}`);
    return response.data;
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