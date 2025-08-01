import React from 'react';

interface DebugPanelProps {
  title: string;
  data: any;
  show: boolean;
}

/**
 * A debug panel component that displays raw data for debugging purposes
 */
const DebugPanel: React.FC<DebugPanelProps> = ({ title, data, show }) => {
  if (!show) return null;
  
  return (
    <div 
      style={{ 
        position: 'fixed', 
        bottom: 0, 
        right: 0, 
        background: 'rgba(0,0,0,0.8)', 
        color: 'white', 
        padding: '8px', 
        maxWidth: '400px',
        maxHeight: '300px',
        overflow: 'auto',
        zIndex: 1000,
        fontSize: '12px',
        fontFamily: 'monospace'
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{title}</div>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export default DebugPanel;