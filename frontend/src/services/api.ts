import axios, { AxiosError } from 'axios';
import { TestScenario, TestResult } from '../types';
import { createLogger } from '../utils/logger';

/**
 * Logger instance for the API service
 * Used to log requests, responses, and errors
 */
const logger = createLogger('api-service');

/**
 * Configured Axios instance for making API requests
 * 
 * This instance is pre-configured with:
 * - Base URL pointing to the API endpoint
 * - Default headers for JSON content
 * - Request and response interceptors for logging and error handling
 */
const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor for logging and request enhancement
 * 
 * This interceptor:
 * 1. Generates a unique request ID for tracing
 * 2. Adds the request ID to headers for correlation
 * 3. Stores the request start time for performance measurement
 * 4. Logs the request details
 * 
 * @param {Object} config - The Axios request configuration
 * @returns {Object} The modified request configuration
 */
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

/**
 * Response interceptor for logging and response processing
 * 
 * This interceptor:
 * 1. Calculates the request duration
 * 2. Logs the response details including status and duration
 * 3. Handles and logs errors with detailed information
 * 
 * @param {Object} response - The Axios response object
 * @returns {Object} The unmodified response object
 */
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
 * 
 * This service provides methods for interacting with the test scenarios and test results API.
 * It handles all HTTP communication with the backend, including error handling and logging.
 */
export const apiService = {
  /**
   * Retrieves all test scenarios from the backend
   * 
   * This method fetches the complete list of test scenarios available in the system.
   * Each test scenario contains information about the test steps, name, description, etc.
   * 
   * @returns {Promise<TestScenario[]>} A promise that resolves to an array of test scenarios
   * 
   * @throws Will throw an error if the API request fails
   * 
   * @example
   * // Get all test scenarios
   * const scenarios = await apiService.getTests();
   * console.log(`Found ${scenarios.length} test scenarios`);
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
   * Retrieves a specific test scenario by its ID
   * 
   * This method fetches a single test scenario with the specified ID.
   * 
   * @param {string} id - The unique identifier of the test scenario to retrieve
   * @returns {Promise<TestScenario>} A promise that resolves to the requested test scenario
   * 
   * @throws Will throw an error if the test scenario doesn't exist or if the API request fails
   * 
   * @example
   * // Get a specific test scenario
   * const scenario = await apiService.getTest('test-123');
   * console.log(`Retrieved test: ${scenario.name}`);
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
   * Creates a new test scenario
   * 
   * This method sends a new test scenario to the backend for creation.
   * The server will assign an ID and timestamps to the new scenario.
   * 
   * @param {Omit<TestScenario, 'id' | 'createdAt' | 'updatedAt'>} test - The test scenario to create,
   *        excluding fields that will be assigned by the server (id, createdAt, updatedAt)
   * @returns {Promise<TestScenario>} A promise that resolves to the created test scenario with server-assigned fields
   * 
   * @throws Will throw an error if the test scenario is invalid or if the API request fails
   * 
   * @example
   * // Create a new test scenario
   * const newScenario = await apiService.createTest({
   *   name: 'Login Test',
   *   description: 'Tests the login functionality',
   *   steps: [
   *     { id: 'step1', type: TestStepType.NAVIGATE, url: 'https://example.com/login' }
   *   ]
   * });
   * console.log(`Created test with ID: ${newScenario.id}`);
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
   * Updates an existing test scenario
   * 
   * This method updates a test scenario with the specified ID using the provided data.
   * Only the fields included in the test parameter will be updated.
   * 
   * @param {string} id - The unique identifier of the test scenario to update
   * @param {Partial<TestScenario>} test - The partial test scenario data to update
   * @returns {Promise<TestScenario>} A promise that resolves to the updated test scenario
   * 
   * @throws Will throw an error if the test scenario doesn't exist, the update is invalid, or if the API request fails
   * 
   * @example
   * // Update a test scenario's name
   * const updatedScenario = await apiService.updateTest('test-123', { name: 'Updated Login Test' });
   * 
   * // Update a test scenario's steps
   * const updatedScenario = await apiService.updateTest('test-123', { 
   *   steps: [
   *     { id: 'step1', type: TestStepType.NAVIGATE, url: 'https://example.com/login' },
   *     { id: 'step2', type: TestStepType.INPUT, selector: '#username', text: 'testuser' }
   *   ]
   * });
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
   * Deletes a test scenario
   * 
   * This method permanently deletes the test scenario with the specified ID.
   * 
   * @param {string} id - The unique identifier of the test scenario to delete
   * @returns {Promise<void>} A promise that resolves when the deletion is complete
   * 
   * @throws Will throw an error if the test scenario doesn't exist or if the API request fails
   * 
   * @example
   * // Delete a test scenario
   * await apiService.deleteTest('test-123');
   * console.log('Test scenario deleted successfully');
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
   * Executes a test scenario
   * 
   * This method triggers the execution of a test scenario with the specified ID.
   * The backend will start running the test and return initial result information.
   * 
   * @param {string} id - The unique identifier of the test scenario to execute
   * @returns {Promise<{ resultId: string; result: TestResult }>} A promise that resolves to an object containing:
   *          - resultId: The ID of the test execution result
   *          - result: The initial test result object
   * 
   * @throws Will throw an error if the test scenario doesn't exist or if the API request fails
   * 
   * @example
   * // Execute a test scenario
   * const { resultId, result } = await apiService.executeTest('test-123');
   * console.log(`Test execution started with result ID: ${resultId}`);
   * console.log(`Initial status: ${result.status}`);
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
   * Retrieves all test results from the backend
   * 
   * This method fetches the complete list of test results available in the system.
   * Each test result contains information about the execution of a test scenario.
   * 
   * @returns {Promise<TestResult[]>} A promise that resolves to an array of test results
   * 
   * @throws Will throw an error if the API request fails
   * 
   * @example
   * // Get all test results
   * const results = await apiService.getTestResults();
   * console.log(`Found ${results.length} test results`);
   * 
   * // Filter results by status
   * const passedTests = results.filter(result => result.status === TestStatus.PASSED);
   * console.log(`${passedTests.length} tests passed`);
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
   * Retrieves a specific test result by its ID
   * 
   * This method fetches a single test result with the specified ID.
   * 
   * @param {string} id - The unique identifier of the test result to retrieve
   * @returns {Promise<TestResult>} A promise that resolves to the requested test result
   * 
   * @throws Will throw an error if the test result doesn't exist or if the API request fails
   * 
   * @example
   * // Get a specific test result
   * const result = await apiService.getTestResult('result-123');
   * console.log(`Test status: ${result.status}`);
   * console.log(`Steps completed: ${result.stepResults.length}`);
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
   * Deletes a test result
   * 
   * This method permanently deletes the test result with the specified ID.
   * 
   * @param {string} id - The unique identifier of the test result to delete
   * @returns {Promise<void>} A promise that resolves when the deletion is complete
   * 
   * @throws Will throw an error if the test result doesn't exist or if the API request fails
   * 
   * @example
   * // Delete a test result
   * await apiService.deleteTestResult('result-123');
   * console.log('Test result deleted successfully');
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