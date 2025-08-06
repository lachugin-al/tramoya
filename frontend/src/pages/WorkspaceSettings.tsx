import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspace, WorkspaceUser } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { FiEdit2, FiTrash2, FiUserPlus, FiCheck, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';

/**
 * WorkspaceSettings page component
 * 
 * This component displays the settings for a workspace, including:
 * - Workspace details (name, description)
 * - Workspace members and their roles
 * - Options to add, edit, or remove members
 * - Option to delete the workspace
 */
const WorkspaceSettings: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    workspaces, 
    currentWorkspace, 
    workspaceUsers, 
    fetchWorkspaceUsers, 
    updateWorkspace,
    deleteWorkspace,
    addUserToWorkspace,
    updateUserRole,
    removeUserFromWorkspace
  } = useWorkspace();

  // State for workspace editing
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // State for adding new user
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'ADMIN' | 'EDITOR' | 'VIEWER'>('VIEWER');

  // State for user being edited
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserRole, setEditingUserRole] = useState<'ADMIN' | 'EDITOR' | 'VIEWER'>('VIEWER');

  // Load workspace data
  useEffect(() => {
    if (!id) return;

    // Find the workspace in the list
    const workspace = workspaces.find(w => w.id === id);
    if (workspace) {
      setName(workspace.name);
      setDescription(workspace.description || '');
      
      // Fetch workspace users
      fetchWorkspaceUsers(id);
    } else {
      // Workspace not found, redirect to home
      toast.error('Workspace not found');
      navigate('/');
    }
  }, [id, workspaces, fetchWorkspaceUsers, navigate]);

  // Check if current user is owner or admin
  const isOwnerOrAdmin = currentWorkspace?.userRole === 'OWNER' || currentWorkspace?.userRole === 'ADMIN';
  const isOwner = currentWorkspace?.userRole === 'OWNER';

  /**
   * Handle workspace update
   */
  const handleUpdateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!id || !name.trim()) return;
    
    try {
      await updateWorkspace(id, name.trim(), description.trim() || undefined);
      setIsEditing(false);
      toast.success('Workspace updated successfully');
    } catch (error) {
      toast.error('Failed to update workspace');
      console.error('Error updating workspace:', error);
    }
  };

  /**
   * Handle workspace deletion
   */
  const handleDeleteWorkspace = async () => {
    if (!id) return;
    
    if (window.confirm('Are you sure you want to delete this workspace? This action cannot be undone.')) {
      try {
        await deleteWorkspace(id);
        toast.success('Workspace deleted successfully');
        navigate('/');
      } catch (error) {
        toast.error('Failed to delete workspace');
        console.error('Error deleting workspace:', error);
      }
    }
  };

  /**
   * Handle adding a new user
   */
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!id || !newUserEmail.trim()) return;
    
    try {
      // In a real implementation, we would search for the user by email first
      // For now, we'll assume the user exists and use a placeholder ID
      const userId = 'placeholder-user-id';
      
      await addUserToWorkspace(id, userId, newUserRole);
      setIsAddingUser(false);
      setNewUserEmail('');
      setNewUserRole('VIEWER');
      toast.success('User added to workspace');
      
      // Refresh the user list
      fetchWorkspaceUsers(id);
    } catch (error) {
      toast.error('Failed to add user to workspace');
      console.error('Error adding user to workspace:', error);
    }
  };

  /**
   * Handle updating a user's role
   */
  const handleUpdateUserRole = async (userId: string) => {
    if (!id || !editingUserId) return;
    
    try {
      await updateUserRole(id, userId, editingUserRole);
      setEditingUserId(null);
      toast.success('User role updated');
      
      // Refresh the user list
      fetchWorkspaceUsers(id);
    } catch (error) {
      toast.error('Failed to update user role');
      console.error('Error updating user role:', error);
    }
  };

  /**
   * Handle removing a user
   */
  const handleRemoveUser = async (userId: string) => {
    if (!id) return;
    
    if (window.confirm('Are you sure you want to remove this user from the workspace?')) {
      try {
        await removeUserFromWorkspace(id, userId);
        toast.success('User removed from workspace');
        
        // Refresh the user list
        fetchWorkspaceUsers(id);
      } catch (error) {
        toast.error('Failed to remove user from workspace');
        console.error('Error removing user from workspace:', error);
      }
    }
  };

  /**
   * Start editing a user's role
   */
  const startEditingUser = (user: WorkspaceUser) => {
    setEditingUserId(user.user.id);
    setEditingUserRole(user.role as 'ADMIN' | 'EDITOR' | 'VIEWER');
  };

  /**
   * Cancel editing a user's role
   */
  const cancelEditingUser = () => {
    setEditingUserId(null);
  };

  // Role options for dropdown
  const roleOptions = [
    { value: 'ADMIN', label: 'Admin' },
    { value: 'EDITOR', label: 'Editor' },
    { value: 'VIEWER', label: 'Viewer' }
  ];

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Workspace Settings</h1>
      
      {/* Workspace Details */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Workspace Details</h2>
          {isOwnerOrAdmin && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center text-primary hover:text-primary-dark"
            >
              <FiEdit2 className="mr-1" /> Edit
            </button>
          )}
        </div>
        
        {isEditing ? (
          <form onSubmit={handleUpdateWorkspace}>
            <div className="mb-4">
              <label htmlFor="name" className="block text-gray-700 font-medium mb-2">
                Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="description" className="block text-gray-700 font-medium mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                rows={3}
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
              >
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          <div>
            <p className="text-gray-700 mb-2"><span className="font-medium">Name:</span> {name}</p>
            <p className="text-gray-700"><span className="font-medium">Description:</span> {description || 'No description'}</p>
          </div>
        )}
        
        {isOwner && !isEditing && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={handleDeleteWorkspace}
              className="flex items-center text-red-600 hover:text-red-800"
            >
              <FiTrash2 className="mr-1" /> Delete Workspace
            </button>
          </div>
        )}
      </div>
      
      {/* Workspace Members */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Workspace Members</h2>
          {isOwnerOrAdmin && (
            <button
              onClick={() => setIsAddingUser(true)}
              className="flex items-center text-primary hover:text-primary-dark"
              disabled={isAddingUser}
            >
              <FiUserPlus className="mr-1" /> Add Member
            </button>
          )}
        </div>
        
        {/* Add User Form */}
        {isAddingUser && (
          <form onSubmit={handleAddUser} className="mb-6 p-4 bg-gray-50 rounded-md">
            <h3 className="font-medium mb-3">Add New Member</h3>
            <div className="mb-3">
              <label htmlFor="email" className="block text-gray-700 font-medium mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="user@example.com"
                required
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="role" className="block text-gray-700 font-medium mb-1">
                Role
              </label>
              <select
                id="role"
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as 'ADMIN' | 'EDITOR' | 'VIEWER')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {roleOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsAddingUser(false)}
                className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-primary text-white rounded-md hover:bg-primary-dark"
              >
                Add Member
              </button>
            </div>
          </form>
        )}
        
        {/* Members List */}
        {workspaceUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  {isOwnerOrAdmin && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {workspaceUsers.map((workspaceUser) => (
                  <tr key={workspaceUser.user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {workspaceUser.user.firstName} {workspaceUser.user.lastName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{workspaceUser.user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingUserId === workspaceUser.user.id ? (
                        <div className="flex items-center">
                          <select
                            value={editingUserRole}
                            onChange={(e) => setEditingUserRole(e.target.value as 'ADMIN' | 'EDITOR' | 'VIEWER')}
                            className="mr-2 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                          >
                            {roleOptions.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleUpdateUserRole(workspaceUser.user.id)}
                            className="text-green-600 hover:text-green-800 mr-1"
                          >
                            <FiCheck />
                          </button>
                          <button
                            onClick={cancelEditingUser}
                            className="text-red-600 hover:text-red-800"
                          >
                            <FiX />
                          </button>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-900">
                          {workspaceUser.role === 'OWNER' ? 'Owner' : 
                           workspaceUser.role === 'ADMIN' ? 'Admin' : 
                           workspaceUser.role === 'EDITOR' ? 'Editor' : 'Viewer'}
                        </div>
                      )}
                    </td>
                    {isOwnerOrAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {/* Don't show edit/delete for the current user or for owners (if not an owner) */}
                        {workspaceUser.user.id !== user?.id && 
                         (isOwner || workspaceUser.role !== 'OWNER') && (
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => startEditingUser(workspaceUser)}
                              className="text-primary hover:text-primary-dark"
                              disabled={editingUserId !== null}
                            >
                              <FiEdit2 />
                            </button>
                            <button
                              onClick={() => handleRemoveUser(workspaceUser.user.id)}
                              className="text-red-600 hover:text-red-800"
                              disabled={workspaceUser.role === 'OWNER'}
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No members found.</p>
        )}
      </div>
    </div>
  );
};

export default WorkspaceSettings;