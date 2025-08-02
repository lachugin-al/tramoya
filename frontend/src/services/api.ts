import axios, { AxiosError } from 'axios';
import { TestScenario, TestResult } from '../types';
import { createLogger } from './logger';

// Create logger for API service
const logger = createLogger('api-service');

// Create axios instance with base URL
const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for logging
api.interceptors.request.use(
  (config) => {
    const { method, url, data, params } = config;
    
    // Generate a unique request ID
    const requestId = Math.random().toString(36).substring(2, 15);
    
    // Add request ID to headers for correlation
    config.headers = config.headers || {};
    config.headers['X-Request-ID'] = requestId;
    
    // Store request start time for performance measurement
    (config as any).startTime = Date.now();
    (config as any).requestId = requestId;
    
    // Log the request
    logger.debug(`Request: ${method?.toUpperCase()} ${url}`, {
      requestId,
      params,
      data: method !== 'get' ? data : undefined
    });
    
    return config;
  },
  (error) => {
    logger.error('Request error', { error: error.message, stack: error.stack });
    return Promise.reject(error);
  }
);

// Add response interceptor for logging
api.interceptors.response.use(
  (response) => {
    const config = response.config;
    const { method, url } = config;
    const requestId = (config as any).requestId;
    
    // Calculate request duration
    const duration = Date.now() - ((config as any).startTime || Date.now());
    
    // Log the response
    logger.debug(`Response: ${method?.toUpperCase()} ${url}`, {
      requestId,
      status: response.status,
      duration: `${duration}ms`,
      data: response.data
    });
    
    return response;
  },
  (error: AxiosError) => {
    const config = error.config;
    
    if (config) {
      const { method, url } = config;
      const requestId = (config as any).requestId;
      
      // Calculate request duration
      const duration = Date.now() - ((config as any).startTime || Date.now());
      
      // Log the error response
      logger.error(`Error response: ${method?.toUpperCase()} ${url}`, {
        requestId,
        status: error.response?.status,
        duration: `${duration}ms`,
        data: error.response?.data,
        error: error.message,
        stack: error.stack
      });
    } else {
      logger.error('API error without config', {
        error: error.message,
        stack: error.stack
      });
    }
    
    return Promise.reject(error);
  }
);

/**
 * API service for communicating with the backend
 */
export const apiService = {
  /**
   * Get all test scenarios
   */
  async getTests(): Promise<TestScenario[]> {
    logger.info('Getting all test scenarios');
    try {
      const response = await api.get('/tests');
      logger.info(`Retrieved ${response.data.length} test scenarios`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get test scenarios', { error });
      throw error;
    }
  },

  /**
   * Get a specific test scenario by ID
   */
  async getTest(id: string): Promise<TestScenario> {
    logger.info(`Getting test scenario: ${id}`);
    try {
      const response = await api.get(`/tests/${id}`);
      logger.info(`Retrieved test scenario: ${id}`, {
        name: response.data.name,
        stepsCount: response.data.steps.length
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to get test scenario: ${id}`, { error });
      throw error;
    }
  },

  /**
   * Create a new test scenario
   */
  async createTest(test: Omit<TestScenario, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestScenario> {
    logger.info('Creating new test scenario', {
      name: test.name,
      stepsCount: test.steps.length
    });
    try {
      const response = await api.post('/tests', test);
      logger.info(`Created new test scenario: ${response.data.id}`, {
        name: response.data.name
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to create test scenario', { error, test: test.name });
      throw error;
    }
  },

  /**
   * Update an existing test scenario
   */
  async updateTest(id: string, test: Partial<TestScenario>): Promise<TestScenario> {
    logger.info(`Updating test scenario: ${id}`, {
      name: test.name,
      stepsCount: test.steps?.length
    });
    try {
      const response = await api.put(`/tests/${id}`, test);
      logger.info(`Updated test scenario: ${id}`, {
        name: response.data.name,
        stepsCount: response.data.steps.length
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to update test scenario: ${id}`, { error });
      throw error;
    }
  },

  /**
   * Delete a test scenario
   */
  async deleteTest(id: string): Promise<void> {
    logger.info(`Deleting test scenario: ${id}`);
    try {
      await api.delete(`/tests/${id}`);
      logger.info(`Deleted test scenario: ${id}`);
    } catch (error) {
      logger.error(`Failed to delete test scenario: ${id}`, { error });
      throw error;
    }
  },

  /**
   * Execute a test scenario
   */
  async executeTest(id: string): Promise<{ resultId: string; result: TestResult }> {
    logger.info(`Executing test scenario: ${id}`);
    try {
      const response = await api.post(`/tests/${id}/execute`);
      logger.info(`Test execution started: ${id}`, {
        resultId: response.data.resultId,
        status: response.data.result.status
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to execute test scenario: ${id}`, { error });
      throw error;
    }
  },

  /**
   * Get all test results
   */
  async getTestResults(): Promise<TestResult[]> {
    logger.info('Getting all test results');
    try {
      const response = await api.get('/tests/results');
      logger.info(`Retrieved ${response.data.length} test results`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get test results', { error });
      throw error;
    }
  },

  /**
   * Get a specific test result by ID
   */
  async getTestResult(id: string): Promise<TestResult> {
    logger.info(`Getting test result: ${id}`);
    try {
      const response = await api.get(`/tests/results/${id}`);
      logger.info(`Retrieved test result: ${id}`, {
        status: response.data.status,
        stepsCount: response.data.stepResults.length
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to get test result: ${id}`, { error });
      throw error;
    }
  },

  /**
   * Delete a test result
   */
  async deleteTestResult(id: string): Promise<void> {
    logger.info(`Deleting test result: ${id}`);
    try {
      await api.delete(`/tests/results/${id}`);
      logger.info(`Deleted test result: ${id}`);
    } catch (error) {
      logger.error(`Failed to delete test result: ${id}`, { error });
      throw error;
    }
  },
};

export default apiService;