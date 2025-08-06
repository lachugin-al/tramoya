/**
 * @fileoverview Main application component that sets up the routing and layout structure
 * for the Tramoya visual test builder application.
 * @module App
 */

import React from 'react';
import {Routes, Route, Link} from 'react-router-dom';
import {ToastContainer} from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';

/**
 * Lazy-loaded component imports to improve initial load performance
 */
const TestList = React.lazy(() => import('./components/TestList'));
const TestBuilder = React.lazy(() => import('./components/TestBuilder'));
const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const WorkspaceSettings = React.lazy(() => import('./pages/WorkspaceSettings'));

/**
 * Main application component that renders the application layout and routes.
 *
 * @component
 * @returns {JSX.Element} The rendered App component with header, main content area, footer, and toast notifications
 */
const App: React.FC = () => {
    return (
        <AuthProvider>
            <WorkspaceProvider>
                <div className="app">
                    <Header />

                    <main className="container">
                        <React.Suspense fallback={<div>Loading...</div>}>
                            <Routes>
                                {/* Public routes */}
                                <Route path="/login" element={<Login />} />
                                <Route path="/register" element={<Register />} />
                                
                                {/* Protected routes */}
                                <Route path="/" element={
                                    <ProtectedRoute>
                                        <TestList />
                                    </ProtectedRoute>
                                } />
                                <Route path="/create" element={
                                    <ProtectedRoute>
                                        <TestBuilder />
                                    </ProtectedRoute>
                                } />
                                <Route path="/edit/:id" element={
                                    <ProtectedRoute>
                                        <TestBuilder />
                                    </ProtectedRoute>
                                } />
                                <Route path="/workspaces/:id/settings" element={
                                    <ProtectedRoute>
                                        <WorkspaceSettings />
                                    </ProtectedRoute>
                                } />
                                <Route path="*" element={<NotFound />} />
                            </Routes>
                        </React.Suspense>
                    </main>

                    <footer className="bg-gray-100 py-4 mt-8">
                        <div className="container">
                            <div className="text-center text-gray-500 text-sm">
                                &copy; {new Date().getFullYear()} Tramoya - Visual Test Builder
                            </div>
                        </div>
                    </footer>

                    <ToastContainer position="bottom-right" />
                </div>
            </WorkspaceProvider>
        </AuthProvider>
    );
};

/**
 * 404 Not Found page component displayed when a user navigates to a non-existent route.
 *
 * @component
 * @returns {JSX.Element} The rendered NotFound component with error message and home link
 */
const NotFound: React.FC = () => {
    return (
        <div className="text-center py-10">
            <h2 className="text-2xl font-bold mb-4">404 - Page Not Found</h2>
            <p className="mb-4">The page you are looking for does not exist.</p>
            <Link to="/" className="button">
                Go Home
            </Link>
        </div>
    );
};

export default App;