import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from './AuthContext';
import workspaceApiService from '../services/workspaceApi';

// Define the Workspace type
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  userRole: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';
}

// Define the WorkspaceUser type
export interface WorkspaceUser {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';
}

// Define the Workspace context
interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  workspaceUsers: WorkspaceUser[];
  isLoading: boolean;
  error: string | null;
  fetchWorkspaces: () => Promise<void>;
  fetchWorkspaceUsers: (workspaceId: string) => Promise<void>;
  createWorkspace: (name: string, description?: string) => Promise<Workspace>;
  updateWorkspace: (id: string, name: string, description?: string) => Promise<Workspace>;
  deleteWorkspace: (id: string) => Promise<void>;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  addUserToWorkspace: (workspaceId: string, userId: string, role: 'ADMIN' | 'EDITOR' | 'VIEWER') => Promise<void>;
  updateUserRole: (workspaceId: string, userId: string, role: 'ADMIN' | 'EDITOR' | 'VIEWER') => Promise<void>;
  removeUserFromWorkspace: (workspaceId: string, userId: string) => Promise<void>;
}

// Create the Workspace context
const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

// Local storage key for current workspace
const CURRENT_WORKSPACE_KEY = 'tramoya_current_workspace';

// Props for the WorkspaceProvider component
interface WorkspaceProviderProps {
  children: ReactNode;
}

// WorkspaceProvider component
export const WorkspaceProvider: React.FC<WorkspaceProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize current workspace from local storage
  useEffect(() => {
    const storedWorkspace = localStorage.getItem(CURRENT_WORKSPACE_KEY);
    if (storedWorkspace) {
      try {
        const workspace = JSON.parse(storedWorkspace);
        setCurrentWorkspace(workspace);
      } catch (error) {
        console.error('Error parsing workspace from localStorage:', error);
      }
    }
  }, []);

  // Update local storage when current workspace changes
  useEffect(() => {
    if (currentWorkspace) {
      localStorage.setItem(CURRENT_WORKSPACE_KEY, JSON.stringify(currentWorkspace));
    } else {
      localStorage.removeItem(CURRENT_WORKSPACE_KEY);
    }
  }, [currentWorkspace]);

  // Fetch workspaces when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchWorkspaces();
    } else {
      setWorkspaces([]);
      setCurrentWorkspace(null);
    }
  }, [isAuthenticated]);

  // Fetch workspaces
  const fetchWorkspaces = async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      const fetchedWorkspaces = await workspaceApiService.getWorkspaces();
      
      setWorkspaces(fetchedWorkspaces);
      
      // Set current workspace if none is selected
      if (!currentWorkspace && fetchedWorkspaces.length > 0) {
        setCurrentWorkspace(fetchedWorkspaces[0]);
      }
    } catch (error) {
      setError('Failed to fetch workspaces');
      toast.error('Failed to fetch workspaces');
      console.error('Error fetching workspaces:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch workspace users
  const fetchWorkspaceUsers = async (workspaceId: string) => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      const users = await workspaceApiService.getWorkspaceUsers(workspaceId);
      setWorkspaceUsers(users);
    } catch (error) {
      setError('Failed to fetch workspace users');
      toast.error('Failed to fetch workspace users');
      console.error('Error fetching workspace users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Create workspace
  const createWorkspace = async (name: string, description?: string): Promise<Workspace> => {
    if (!isAuthenticated) {
      throw new Error('Not authenticated');
    }

    setIsLoading(true);
    setError(null);

    try {
      const newWorkspace = await workspaceApiService.createWorkspace(name, description);
      
      setWorkspaces([...workspaces, newWorkspace]);
      setCurrentWorkspace(newWorkspace);
      
      toast.success('Workspace created successfully');
      return newWorkspace;
    } catch (error) {
      setError('Failed to create workspace');
      toast.error('Failed to create workspace');
      console.error('Error creating workspace:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Update workspace
  const updateWorkspace = async (id: string, name: string, description?: string): Promise<Workspace> => {
    if (!isAuthenticated) {
      throw new Error('Not authenticated');
    }

    setIsLoading(true);
    setError(null);

    try {
      const updatedWorkspace = await workspaceApiService.updateWorkspace(id, name, description);
      
      // Update workspace in state
      const updatedWorkspaces = workspaces.map(workspace => {
        if (workspace.id === id) {
          // Update current workspace if it's the one being updated
          if (currentWorkspace?.id === id) {
            setCurrentWorkspace(updatedWorkspace);
          }
          
          return updatedWorkspace;
        }
        return workspace;
      });
      
      setWorkspaces(updatedWorkspaces);
      
      toast.success('Workspace updated successfully');
      return updatedWorkspace;
    } catch (error) {
      setError('Failed to update workspace');
      toast.error('Failed to update workspace');
      console.error('Error updating workspace:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete workspace
  const deleteWorkspace = async (id: string): Promise<void> => {
    if (!isAuthenticated) {
      throw new Error('Not authenticated');
    }

    setIsLoading(true);
    setError(null);

    try {
      await workspaceApiService.deleteWorkspace(id);
      
      // Remove workspace from state
      const updatedWorkspaces = workspaces.filter(workspace => workspace.id !== id);
      setWorkspaces(updatedWorkspaces);
      
      // If current workspace is deleted, set to null or first available
      if (currentWorkspace?.id === id) {
        setCurrentWorkspace(updatedWorkspaces.length > 0 ? updatedWorkspaces[0] : null);
      }
      
      toast.success('Workspace deleted successfully');
    } catch (error) {
      setError('Failed to delete workspace');
      toast.error('Failed to delete workspace');
      console.error('Error deleting workspace:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Add user to workspace
  const addUserToWorkspace = async (
    workspaceId: string, 
    userId: string, 
    role: 'ADMIN' | 'EDITOR' | 'VIEWER'
  ): Promise<void> => {
    if (!isAuthenticated) {
      throw new Error('Not authenticated');
    }

    setIsLoading(true);
    setError(null);

    try {
      await workspaceApiService.addUserToWorkspace(workspaceId, userId, role);
      
      // Refresh the workspace users list
      await fetchWorkspaceUsers(workspaceId);
      
      toast.success('User added to workspace successfully');
    } catch (error) {
      setError('Failed to add user to workspace');
      toast.error('Failed to add user to workspace');
      console.error('Error adding user to workspace:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Update user role
  const updateUserRole = async (
    workspaceId: string, 
    userId: string, 
    role: 'ADMIN' | 'EDITOR' | 'VIEWER'
  ): Promise<void> => {
    if (!isAuthenticated) {
      throw new Error('Not authenticated');
    }

    setIsLoading(true);
    setError(null);

    try {
      await workspaceApiService.updateUserRole(workspaceId, userId, role);
      
      // Update user role in state
      const updatedUsers = workspaceUsers.map(user => {
        if (user.user.id === userId) {
          return {
            ...user,
            role
          };
        }
        return user;
      });
      
      setWorkspaceUsers(updatedUsers);
      
      toast.success('User role updated successfully');
    } catch (error) {
      setError('Failed to update user role');
      toast.error('Failed to update user role');
      console.error('Error updating user role:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Remove user from workspace
  const removeUserFromWorkspace = async (workspaceId: string, userId: string): Promise<void> => {
    if (!isAuthenticated) {
      throw new Error('Not authenticated');
    }

    setIsLoading(true);
    setError(null);

    try {
      await workspaceApiService.removeUserFromWorkspace(workspaceId, userId);
      
      // Remove user from state
      const updatedUsers = workspaceUsers.filter(user => user.user.id !== userId);
      setWorkspaceUsers(updatedUsers);
      
      toast.success('User removed from workspace successfully');
    } catch (error) {
      setError('Failed to remove user from workspace');
      toast.error('Failed to remove user from workspace');
      console.error('Error removing user from workspace:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Create the context value
  const contextValue: WorkspaceContextType = {
    workspaces,
    currentWorkspace,
    workspaceUsers,
    isLoading,
    error,
    fetchWorkspaces,
    fetchWorkspaceUsers,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    setCurrentWorkspace,
    addUserToWorkspace,
    updateUserRole,
    removeUserFromWorkspace
  };

  return (
    <WorkspaceContext.Provider value={contextValue}>
      {children}
    </WorkspaceContext.Provider>
  );
};

// Custom hook for using the workspace context
export const useWorkspace = (): WorkspaceContextType => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};