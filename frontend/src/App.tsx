/**
 * @fileoverview Main application component that sets up the routing and layout structure
 * for the Tramoya visual test builder application.
 * @module App
 */

import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

/**
 * Lazy-loaded component imports to improve initial load performance
 */
const TestList = React.lazy(() => import('./components/TestList'));
const TestBuilder = React.lazy(() => import('./components/TestBuilder'));

/**
 * Main application component that renders the application layout and routes.
 * 
 * @component
 * @returns {JSX.Element} The rendered App component with header, main content area, footer, and toast notifications
 */
const App: React.FC = () => {
  return (
    <div className="app">
      <header className="bg-primary">
        <div className="container">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-white font-bold text-xl">Tramoya</h1>
            <nav>
              <ul className="flex gap-4">
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
              </ul>
            </nav>
          </div>
        </div>
      </header>

      <main className="container">
        <React.Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/" element={<TestList />} />
            <Route path="/create" element={<TestBuilder />} />
            <Route path="/edit/:id" element={<TestBuilder />} />
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