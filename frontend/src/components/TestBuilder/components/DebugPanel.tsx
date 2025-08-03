import React from 'react';

/**
 * Props for the DebugPanel component
 *
 * @interface DebugPanelProps
 * @property {string} title - The title to display at the top of the debug panel
 * @property {any} data - The data to display in the debug panel (will be stringified as JSON)
 * @property {boolean} show - Whether the debug panel should be visible
 */
interface DebugPanelProps {
    title: string;
    data: any;
    show: boolean;
}

/**
 * DebugPanel Component
 *
 * @component
 * @description A utility component that displays raw data in a fixed-position panel
 * for debugging purposes. The panel shows the data as formatted JSON.
 * The component is conditionally rendered based on the show prop.
 *
 * @param {DebugPanelProps} props - Component props
 * @returns {JSX.Element|null} The rendered debug panel or null if show is false
 *
 * @example
 * ```tsx
 * <DebugPanel
 *   title="Test Result"
 *   data={testResult}
 *   show={debugMode}
 * />
 * ```
 */
const DebugPanel: React.FC<DebugPanelProps> = ({title, data, show}) => {
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
            <div style={{fontWeight: 'bold', marginBottom: '4px'}}>{title}</div>
            <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
    );
};

export default DebugPanel;