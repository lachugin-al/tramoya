import React from 'react';
import { useNavigate } from 'react-router-dom';

interface TestHeaderProps {
  testName: string;
  onTestNameChange: (name: string) => void;
  onSave: () => void;
  saving: boolean;
}

const TestHeader: React.FC<TestHeaderProps> = ({
  testName,
  onTestNameChange,
  onSave,
  saving
}) => {
  const navigate = useNavigate();

  return (
    <div className="test-builder-header">
      <button
        onClick={() => navigate('/')}
        className="header-button"
        title="Back to Tests"
      >
        <span className="icon">←</span>
      </button>
      
      <input
        type="text"
        value={testName}
        onChange={(e) => onTestNameChange(e.target.value)}
        placeholder="Untitled Test"
        className="test-name-input"
      />
      
      <div className="header-actions">
        <button
          onClick={onSave}
          className="header-button action-button save-button"
          disabled={saving || !testName.trim()}
        >
          <span className="icon">💾</span>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <style>
        {`
          .header-button {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            background: white;
            color: #374151;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }
          
          .header-button:hover:not(:disabled) {
            background: #f9fafb;
            border-color: #9ca3af;
          }
          
          .header-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          
          .icon {
            font-size: 16px;
          }
          
          .test-name-input {
            flex: 1;
            max-width: 400px;
            padding: 12px 16px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 18px;
            font-weight: 600;
            color: #111827;
            background: white;
            transition: border-color 0.2s;
          }
          
          .test-name-input:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }
          
          .header-actions {
            display: flex;
            gap: 12px;
            margin-left: auto;
          }
          
          .action-button {
            font-weight: 600;
          }
          
          .save-button {
            background: #3b82f6;
            color: white;
            border-color: #3b82f6;
          }
          
          .save-button:hover:not(:disabled) {
            background: #2563eb;
            border-color: #2563eb;
          }
        `}
      </style>
    </div>
  );
};

export default TestHeader;