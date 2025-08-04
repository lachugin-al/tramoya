import React from 'react';

/**
 * Props for the TestBuilderLayout component
 *
 * @interface TestBuilderLayoutProps
 * @property {React.ReactNode} children - The content to render inside the layout
 */
interface TestBuilderLayoutProps {
    children: React.ReactNode;
}

/**
 * TestBuilderLayout Component
 *
 * @component
 * @description A layout wrapper component that provides a consistent structure for the test builder UI.
 * The layout includes a header section and a content area split into two panels:
 * a steps panel on the left and a preview panel on the right.
 *
 * @param {TestBuilderLayoutProps} props - Component props
 * @returns {JSX.Element} The rendered layout with children
 *
 * @example
 * ```tsx
 * <TestBuilderLayout>
 *   <div>Content goes here</div>
 * </TestBuilderLayout>
 * ```
 */
const TestBuilderLayout: React.FC<TestBuilderLayoutProps> = ({children}) => {
    return (
        <div className="test-builder-layout">
            <style>
                {`
          .test-builder-layout {
            height: 100vh;
            display: flex;
            flex-direction: column;
            background: #fafafb;
          }
          
          .test-builder-header {
            height: 64px;
            background: white;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            align-items: center;
            padding: 0 24px;
            gap: 16px;
            flex-shrink: 0;
          }
          
          .test-builder-content {
            flex: 1;
            display: flex;
            overflow: hidden;
          }
          
          .steps-panel {
            width: 320px;
            background: white;
            border-right: 1px solid #e5e7eb;
            flex-shrink: 0;
            overflow-y: auto;
          }
          
          .preview-panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
          }
          
          .preview-header {
            height: 56px;
            background: white;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 24px;
            flex-shrink: 0;
          }
          
          .preview-content {
            flex: 1;
            background: #f3f4f6;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }
        `}
            </style>
            {children}
        </div>
    );
};

export default TestBuilderLayout;