/**
 * Step Type Metadata Constants
 * 
 * This file contains constants related to test step types, including icons, labels, and descriptions.
 * These constants are used across the application to provide consistent metadata for test steps.
 */

import { TestStepType } from '../types';

/**
 * Icons for each test step type
 *
 * @constant
 * @type {Record<TestStepType, string>}
 * @description Emoji icons representing each type of test step
 */
export const StepIcons: Record<TestStepType, string> = {
    [TestStepType.NAVIGATE]: '🌐',
    [TestStepType.INPUT]: '⌨️',
    [TestStepType.CLICK]: '🖱️',
    [TestStepType.ASSERT_TEXT]: '📝',
    [TestStepType.ASSERT_VISIBLE]: '👁️',
    [TestStepType.WAIT]: '⏱️',
    [TestStepType.ASSERT_URL]: '🔗',
    [TestStepType.SCREENSHOT]: '📷',
};

/**
 * Display labels for each test step type
 *
 * @constant
 * @type {Record<TestStepType, string>}
 * @description Human-readable labels for each type of test step
 */
export const StepLabels: Record<TestStepType, string> = {
    [TestStepType.NAVIGATE]: 'Navigate',
    [TestStepType.INPUT]: 'Type text',
    [TestStepType.CLICK]: 'Click',
    [TestStepType.ASSERT_TEXT]: 'Assert text',
    [TestStepType.ASSERT_VISIBLE]: 'Assert visible',
    [TestStepType.WAIT]: 'Wait',
    [TestStepType.ASSERT_URL]: 'Assert URL',
    [TestStepType.SCREENSHOT]: 'Screenshot',
};

/**
 * Descriptions for each test step type
 *
 * @constant
 * @type {Record<TestStepType, string>}
 * @description Short descriptions explaining the purpose of each test step type
 */
export const StepDescriptions: Record<TestStepType, string> = {
    [TestStepType.NAVIGATE]: 'Go to URL',
    [TestStepType.INPUT]: 'Enter text in field',
    [TestStepType.CLICK]: 'Click element',
    [TestStepType.ASSERT_TEXT]: 'Check text content',
    [TestStepType.ASSERT_VISIBLE]: 'Check visibility',
    [TestStepType.WAIT]: 'Pause execution',
    [TestStepType.ASSERT_URL]: 'Check current URL',
    [TestStepType.SCREENSHOT]: 'Take screenshot',
};

/**
 * Templates for available test step types
 * Each template includes an icon, label, and description for display in the UI
 *
 * @constant
 * @type {Array<{type: TestStepType, icon: string, label: string, description: string}>}
 */
export const StepTemplates = Object.values(TestStepType).map(type => ({
    type,
    icon: StepIcons[type],
    label: StepLabels[type],
    description: StepDescriptions[type],
}));