import { PrismaClient, Test, Role } from '@prisma/client';
import { createLogger } from '../utils/logger';
import { TestScenario, TestStep } from '../models/test-scenario';
import { TestResult, TestStatus } from '../models/test-result';

const logger = createLogger('test-service');

/**
 * Service for test management
 * 
 * This service provides methods for creating, retrieving, updating, and deleting tests,
 * as well as executing tests and managing test results.
 */
export class TestService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get all tests in a workspace
   * 
   * @param workspaceId - ID of the workspace
   * @returns Array of tests in the workspace
   */
  async getTestsByWorkspace(workspaceId: string): Promise<Test[]> {
    try {
      logger.debug('Getting tests for workspace', { workspaceId });

      const tests = await this.prisma.test.findMany({
        where: {
          workspaceId
        }
      });

      logger.debug('Retrieved tests for workspace', { 
        workspaceId, 
        count: tests.length 
      });

      return tests;
    } catch (error) {
      logger.error('Error getting tests for workspace', { 
        error: error instanceof Error ? error.message : String(error),
        workspaceId
      });
      throw error;
    }
  }

  /**
   * Get test by ID
   * 
   * @param testId - ID of the test
   * @param workspaceId - ID of the workspace (for validation)
   * @returns The test or null if not found
   */
  async getTestById(testId: string, workspaceId: string): Promise<Test | null> {
    try {
      logger.debug('Getting test by ID', { testId, workspaceId });

      const test = await this.prisma.test.findFirst({
        where: {
          id: testId,
          workspaceId
        }
      });

      if (!test) {
        logger.debug('Test not found', { testId, workspaceId });
        return null;
      }

      logger.debug('Retrieved test', { testId, workspaceId });
      return test;
    } catch (error) {
      logger.error('Error getting test by ID', { 
        error: error instanceof Error ? error.message : String(error),
        testId,
        workspaceId
      });
      throw error;
    }
  }

  /**
   * Create a new test
   * 
   * @param workspaceId - ID of the workspace
   * @param userId - ID of the user creating the test
   * @param name - Test name
   * @param description - Optional test description
   * @param steps - Test steps
   * @returns The created test
   */
  async createTest(
    workspaceId: string,
    userId: string,
    name: string,
    description: string | undefined,
    steps: TestStep[]
  ): Promise<Test> {
    try {
      logger.debug('Creating new test', { workspaceId, name });

      // Convert TestScenario to database format
      const testConfig = {
        steps: steps || []
      };

      const test = await this.prisma.test.create({
        data: {
          workspaceId,
          name,
          description,
          config: testConfig as any,
          createdById: userId
        }
      });

      logger.info('Test created successfully', { 
        testId: test.id, 
        workspaceId, 
        name 
      });

      return test;
    } catch (error) {
      logger.error('Error creating test', { 
        error: error instanceof Error ? error.message : String(error),
        workspaceId,
        name
      });
      throw error;
    }
  }

  /**
   * Update an existing test
   * 
   * @param testId - ID of the test to update
   * @param workspaceId - ID of the workspace (for validation)
   * @param name - New test name
   * @param description - New test description
   * @param steps - New test steps
   * @returns The updated test
   */
  async updateTest(
    testId: string,
    workspaceId: string,
    name: string,
    description: string | undefined,
    steps: TestStep[]
  ): Promise<Test> {
    try {
      logger.debug('Updating test', { testId, workspaceId, name });

      // Check if test exists in the workspace
      const existingTest = await this.getTestById(testId, workspaceId);
      if (!existingTest) {
        logger.warn('Test not found for update', { testId, workspaceId });
        throw new Error('Test not found');
      }

      // Convert TestScenario to database format
      const testConfig = {
        steps: steps || []
      };

      const test = await this.prisma.test.update({
        where: {
          id: testId
        },
        data: {
          name,
          description,
          config: testConfig as any
        }
      });

      logger.info('Test updated successfully', { 
        testId, 
        workspaceId, 
        name 
      });

      return test;
    } catch (error) {
      logger.error('Error updating test', { 
        error: error instanceof Error ? error.message : String(error),
        testId,
        workspaceId
      });
      throw error;
    }
  }

  /**
   * Delete a test
   * 
   * @param testId - ID of the test to delete
   * @param workspaceId - ID of the workspace (for validation)
   */
  async deleteTest(testId: string, workspaceId: string): Promise<void> {
    try {
      logger.debug('Deleting test', { testId, workspaceId });

      // Check if test exists in the workspace
      const existingTest = await this.getTestById(testId, workspaceId);
      if (!existingTest) {
        logger.warn('Test not found for deletion', { testId, workspaceId });
        throw new Error('Test not found');
      }

      await this.prisma.test.delete({
        where: {
          id: testId
        }
      });

      logger.info('Test deleted successfully', { 
        testId, 
        workspaceId 
      });
    } catch (error) {
      logger.error('Error deleting test', { 
        error: error instanceof Error ? error.message : String(error),
        testId,
        workspaceId
      });
      throw error;
    }
  }

  /**
   * Check if user has permission to access a test
   * 
   * @param userId - ID of the user
   * @param testId - ID of the test
   * @param requiredRole - Required role or array of roles
   * @returns True if user has permission, false otherwise
   */
  async hasTestPermission(
    userId: string,
    testId: string,
    requiredRole: Role | Role[]
  ): Promise<boolean> {
    try {
      logger.debug('Checking test permission', { userId, testId });

      // Get the test to find its workspace
      const test = await this.prisma.test.findUnique({
        where: {
          id: testId
        }
      });

      if (!test) {
        logger.debug('Test not found for permission check', { testId });
        return false;
      }

      // Check user's role in the workspace
      const userWorkspaceRole = await this.prisma.userWorkspaceRole.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: test.workspaceId
          }
        }
      });

      if (!userWorkspaceRole) {
        logger.debug('User has no role in workspace', { 
          userId, 
          workspaceId: test.workspaceId 
        });
        return false;
      }

      // Check if user has one of the required roles
      const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      const hasRole = requiredRoles.includes(userWorkspaceRole.role);

      logger.debug('Test permission check result', { 
        userId, 
        testId, 
        userRole: userWorkspaceRole.role,
        requiredRoles,
        hasRole 
      });

      return hasRole;
    } catch (error) {
      logger.error('Error checking test permission', { 
        error: error instanceof Error ? error.message : String(error),
        userId,
        testId
      });
      return false;
    }
  }

  /**
   * Convert database Test model to TestScenario
   * 
   * @param test - Database Test model
   * @returns TestScenario object
   */
  convertToTestScenario(test: Test): TestScenario {
    const config = test.config as any;
    return {
      id: test.id,
      name: test.name,
      description: test.description || undefined,
      createdAt: test.createdAt,
      updatedAt: test.updatedAt,
      steps: config.steps || []
    };
  }

  /**
   * Store test result
   * 
   * @param result - Test result to store
   * @returns The stored test result
   */
  async storeTestResult(result: TestResult): Promise<TestResult> {
    // In a real implementation, this would store the result in the database
    // For now, we'll just return the result as is
    return result;
  }

  /**
   * Get test result by ID
   * 
   * @param resultId - ID of the test result
   * @returns The test result or null if not found
   */
  async getTestResult(resultId: string): Promise<TestResult | null> {
    // In a real implementation, this would retrieve the result from the database
    // For now, we'll return null
    return null;
  }

  /**
   * Get all test results
   * 
   * @param workspaceId - ID of the workspace
   * @returns Array of test results
   */
  async getTestResults(workspaceId: string): Promise<TestResult[]> {
    // In a real implementation, this would retrieve results from the database
    // For now, we'll return an empty array
    return [];
  }
}