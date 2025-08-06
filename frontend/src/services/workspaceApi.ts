import axios, { AxiosError } from 'axios';
import { Workspace, WorkspaceUser } from '../contexts/WorkspaceContext';
import { createLogger } from '../utils/logger';

/**
 * Logger instance for the Workspace API service
 */
const logger = createLogger('workspace-api-service');

/**
 * Configured Axios instance for making workspace API requests
 */
const workspaceApi = axios.create({
  baseURL: '/api/v1/workspaces',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Authentication token interceptor
 * 
 * This interceptor adds the authentication token to the request headers if available.
 * It gets the token from local storage and adds it to the Authorization header.
 * 
 * @param {Object} config - The Axios request configuration
 * @returns {Object} The modified request configuration with auth token
 */
workspaceApi.interceptors.request.use(
  (config) => {
    // Get token from local storage
    const token = localStorage.getItem('tramoya_auth_token');
    
    // Add token to headers if available
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    logger.error('Auth token interceptor error', {error: error.message, stack: error.stack});
    return Promise.reject(error);
  }
);


/**
 * Workspace API service
 * 
 * This service provides methods for workspace management, including creating, updating,
 * and deleting workspaces, as well as managing users in workspaces.
 */
export const workspaceApiService = {
  /**
   * Get all workspaces accessible by the current user
   * 
   * @returns Promise resolving to an array of workspaces
   * @throws Error if fetching workspaces fails
   */
  async getWorkspaces(): Promise<Workspace[]> {
    try {
      logger.info('Getting workspaces');
      
      const response = await workspaceApi.get<Workspace[]>('/');
      
      logger.info(`Retrieved ${response.data.length} workspaces`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get workspaces', { 
        error: error instanceof Error ? error.message : String(error)
      });
      
      if (error instanceof AxiosError && error.response) {
        throw new Error(error.response.data.error || 'Failed to get workspaces');
      }
      
      throw new Error('Failed to get workspaces. Please try again.');
    }
  },
  
  /**
   * Get a specific workspace by ID
   * 
   * @param id - Workspace ID
   * @returns Promise resolving to the workspace
   * @throws Error if fetching the workspace fails
   */
  async getWorkspace(id: string): Promise<Workspace> {
    try {
      logger.info(`Getting workspace: ${id}`);
      
      const response = await workspaceApi.get<Workspace>(`/${id}`);
      
      logger.info(`Retrieved workspace: ${id}`, { name: response.data.name });
      return response.data;
    } catch (error) {
      logger.error(`Failed to get workspace: ${id}`, { 
        error: error instanceof Error ? error.message : String(error)
      });
      
      if (error instanceof AxiosError && error.response) {
        throw new Error(error.response.data.error || 'Failed to get workspace');
      }
      
      throw new Error('Failed to get workspace. Please try again.');
    }
  },
  
  /**
   * Create a new workspace
   * 
   * @param name - Workspace name
   * @param description - Optional workspace description
   * @returns Promise resolving to the created workspace
   * @throws Error if creating the workspace fails
   */
  async createWorkspace(name: string, description?: string): Promise<Workspace> {
    try {
      logger.info('Creating workspace', { name });
      
      const response = await workspaceApi.post<Workspace>('/', { name, description });
      
      logger.info(`Created workspace: ${response.data.id}`, { name });
      return response.data;
    } catch (error) {
      logger.error('Failed to create workspace', { 
        error: error instanceof Error ? error.message : String(error),
        name
      });
      
      if (error instanceof AxiosError && error.response) {
        throw new Error(error.response.data.error || 'Failed to create workspace');
      }
      
      throw new Error('Failed to create workspace. Please try again.');
    }
  },
  
  /**
   * Update a workspace
   * 
   * @param id - Workspace ID
   * @param name - New workspace name
   * @param description - New workspace description
   * @returns Promise resolving to the updated workspace
   * @throws Error if updating the workspace fails
   */
  async updateWorkspace(id: string, name: string, description?: string): Promise<Workspace> {
    try {
      logger.info(`Updating workspace: ${id}`, { name });
      
      const response = await workspaceApi.put<Workspace>(`/${id}`, { name, description });
      
      logger.info(`Updated workspace: ${id}`, { name });
      return response.data;
    } catch (error) {
      logger.error(`Failed to update workspace: ${id}`, { 
        error: error instanceof Error ? error.message : String(error),
        name
      });
      
      if (error instanceof AxiosError && error.response) {
        throw new Error(error.response.data.error || 'Failed to update workspace');
      }
      
      throw new Error('Failed to update workspace. Please try again.');
    }
  },
  
  /**
   * Delete a workspace
   * 
   * @param id - Workspace ID
   * @returns Promise that resolves when deletion is complete
   * @throws Error if deleting the workspace fails
   */
  async deleteWorkspace(id: string): Promise<void> {
    try {
      logger.info(`Deleting workspace: ${id}`);
      
      await workspaceApi.delete(`/${id}`);
      
      logger.info(`Deleted workspace: ${id}`);
    } catch (error) {
      logger.error(`Failed to delete workspace: ${id}`, { 
        error: error instanceof Error ? error.message : String(error)
      });
      
      if (error instanceof AxiosError && error.response) {
        throw new Error(error.response.data.error || 'Failed to delete workspace');
      }
      
      throw new Error('Failed to delete workspace. Please try again.');
    }
  },
  
  /**
   * Get users in a workspace
   * 
   * @param workspaceId - Workspace ID
   * @returns Promise resolving to an array of workspace users
   * @throws Error if fetching workspace users fails
   */
  async getWorkspaceUsers(workspaceId: string): Promise<WorkspaceUser[]> {
    try {
      logger.info(`Getting users for workspace: ${workspaceId}`);
      
      const response = await workspaceApi.get<WorkspaceUser[]>(`/${workspaceId}/users`);
      
      logger.info(`Retrieved ${response.data.length} users for workspace: ${workspaceId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get users for workspace: ${workspaceId}`, { 
        error: error instanceof Error ? error.message : String(error)
      });
      
      if (error instanceof AxiosError && error.response) {
        throw new Error(error.response.data.error || 'Failed to get workspace users');
      }
      
      throw new Error('Failed to get workspace users. Please try again.');
    }
  },
  
  /**
   * Add a user to a workspace
   * 
   * @param workspaceId - Workspace ID
   * @param userId - User ID to add
   * @param role - Role to assign (ADMIN, EDITOR, VIEWER)
   * @returns Promise that resolves when the user is added
   * @throws Error if adding the user fails
   */
  async addUserToWorkspace(
    workspaceId: string, 
    userId: string, 
    role: 'ADMIN' | 'EDITOR' | 'VIEWER'
  ): Promise<void> {
    try {
      logger.info(`Adding user to workspace: ${workspaceId}`, { userId, role });
      
      await workspaceApi.post(`/${workspaceId}/users`, { userId, role });
      
      logger.info(`Added user to workspace: ${workspaceId}`, { userId, role });
    } catch (error) {
      logger.error(`Failed to add user to workspace: ${workspaceId}`, { 
        error: error instanceof Error ? error.message : String(error),
        userId,
        role
      });
      
      if (error instanceof AxiosError && error.response) {
        throw new Error(error.response.data.error || 'Failed to add user to workspace');
      }
      
      throw new Error('Failed to add user to workspace. Please try again.');
    }
  },
  
  /**
   * Update a user's role in a workspace
   * 
   * @param workspaceId - Workspace ID
   * @param userId - User ID
   * @param role - New role (ADMIN, EDITOR, VIEWER)
   * @returns Promise that resolves when the role is updated
   * @throws Error if updating the role fails
   */
  async updateUserRole(
    workspaceId: string, 
    userId: string, 
    role: 'ADMIN' | 'EDITOR' | 'VIEWER'
  ): Promise<void> {
    try {
      logger.info(`Updating user role in workspace: ${workspaceId}`, { userId, role });
      
      await workspaceApi.put(`/${workspaceId}/users/${userId}`, { role });
      
      logger.info(`Updated user role in workspace: ${workspaceId}`, { userId, role });
    } catch (error) {
      logger.error(`Failed to update user role in workspace: ${workspaceId}`, { 
        error: error instanceof Error ? error.message : String(error),
        userId,
        role
      });
      
      if (error instanceof AxiosError && error.response) {
        throw new Error(error.response.data.error || 'Failed to update user role');
      }
      
      throw new Error('Failed to update user role. Please try again.');
    }
  },
  
  /**
   * Remove a user from a workspace
   * 
   * @param workspaceId - Workspace ID
   * @param userId - User ID to remove
   * @returns Promise that resolves when the user is removed
   * @throws Error if removing the user fails
   */
  async removeUserFromWorkspace(workspaceId: string, userId: string): Promise<void> {
    try {
      logger.info(`Removing user from workspace: ${workspaceId}`, { userId });
      
      await workspaceApi.delete(`/${workspaceId}/users/${userId}`);
      
      logger.info(`Removed user from workspace: ${workspaceId}`, { userId });
    } catch (error) {
      logger.error(`Failed to remove user from workspace: ${workspaceId}`, { 
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      
      if (error instanceof AxiosError && error.response) {
        throw new Error(error.response.data.error || 'Failed to remove user from workspace');
      }
      
      throw new Error('Failed to remove user from workspace. Please try again.');
    }
  }
};

export default workspaceApiService;