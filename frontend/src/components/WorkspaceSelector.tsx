import React, { useState, useEffect } from 'react';
import { useWorkspace, Workspace } from '../contexts/WorkspaceContext';
import { FiChevronDown, FiPlus } from 'react-icons/fi';

/**
 * WorkspaceSelector component
 * 
 * This component displays a dropdown menu for selecting the current workspace
 * and provides an option to create a new workspace.
 */
const WorkspaceSelector: React.FC = () => {
  const { workspaces, currentWorkspace, setCurrentWorkspace, createWorkspace } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.workspace-selector')) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  /**
   * Handle workspace selection
   * 
   * @param workspace - The selected workspace
   */
  const handleSelectWorkspace = (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    setIsOpen(false);
  };

  /**
   * Handle creating a new workspace
   */
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newWorkspaceName.trim()) return;
    
    try {
      await createWorkspace(
        newWorkspaceName.trim(),
        newWorkspaceDescription.trim() || undefined
      );
      
      setNewWorkspaceName('');
      setNewWorkspaceDescription('');
      setIsCreating(false);
      setIsOpen(false);
    } catch (error) {
      console.error('Error creating workspace:', error);
    }
  };

  /**
   * Toggle the create workspace form
   */
  const toggleCreateForm = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCreating(!isCreating);
  };

  return (
    <div className="workspace-selector relative">
      <button
        className="flex items-center space-x-2 bg-white text-primary px-3 py-2 rounded hover:bg-gray-100 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{currentWorkspace?.name || 'Select Workspace'}</span>
        <FiChevronDown />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-md shadow-lg z-10">
          {workspaces.length > 0 ? (
            <ul className="py-1">
              {workspaces.map((workspace) => (
                <li key={workspace.id}>
                  <button
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${
                      currentWorkspace?.id === workspace.id ? 'bg-gray-100 font-medium' : ''
                    }`}
                    onClick={() => handleSelectWorkspace(workspace)}
                  >
                    {workspace.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-2 text-gray-500">No workspaces available</p>
          )}
          
          <div className="border-t border-gray-200">
            {isCreating ? (
              <form onSubmit={handleCreateWorkspace} className="p-4">
                <h3 className="font-medium mb-2">Create Workspace</h3>
                <div className="mb-2">
                  <input
                    type="text"
                    placeholder="Workspace Name"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    required
                  />
                </div>
                <div className="mb-3">
                  <textarea
                    placeholder="Description (optional)"
                    value={newWorkspaceDescription}
                    onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    rows={2}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
                    onClick={() => setIsCreating(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary-dark"
                  >
                    Create
                  </button>
                </div>
              </form>
            ) : (
              <button
                className="w-full text-left px-4 py-2 text-primary hover:bg-gray-100 flex items-center"
                onClick={toggleCreateForm}
              >
                <FiPlus className="mr-2" />
                Create New Workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceSelector;