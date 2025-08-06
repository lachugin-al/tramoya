import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import WorkspaceSelector from './WorkspaceSelector';

/**
 * Header component with navigation
 * 
 * This component displays the application header with navigation links.
 * It shows different navigation options based on whether the user is authenticated.
 */
const Header: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  /**
   * Handle logout button click
   */
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-primary">
      <div className="container">
        <div className="flex justify-between items-center py-4">
          <h1 className="text-white font-bold text-xl">Tramoya</h1>
          
          <nav>
            <ul className="flex gap-4 items-center">
              {isAuthenticated ? (
                // Navigation for authenticated users
                <>
                  <li>
                    <Link to="/" className="text-white hover:text-gray-200">
                      Tests
                    </Link>
                  </li>
                  <li>
                    <Link to="/create" className="text-white hover:text-gray-200">
                      Create Test
                    </Link>
                  </li>
                  <li className="ml-4">
                    <WorkspaceSelector />
                  </li>
                  <li className="ml-4">
                    <span className="text-white mr-2">
                      {user?.firstName} {user?.lastName}
                    </span>
                    <button
                      onClick={handleLogout}
                      className="bg-white text-primary px-3 py-1 rounded hover:bg-gray-200 transition-colors"
                    >
                      Logout
                    </button>
                  </li>
                </>
              ) : (
                // Navigation for unauthenticated users
                <>
                  <li>
                    <Link to="/login" className="text-white hover:text-gray-200">
                      Login
                    </Link>
                  </li>
                  <li>
                    <Link to="/register" className="text-white hover:text-gray-200">
                      Register
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;