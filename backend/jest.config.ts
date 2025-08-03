import type {Config} from '@jest/types';

const config: Config.InitialOptions = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/tests'],
    testMatch: [
        '**/__tests__/**/*.+(ts|tsx|js)',
        '**/?(*.)+(spec|test).+(ts|tsx|js)'
    ],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest'
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    collectCoverage: true,
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/types/**/*',
        '!src/index.ts'
    ],
    coverageThreshold: {
        global: {
            branches: 3,
            functions: 3,
            lines: 3,
            statements: 3
        }
    },
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    verbose: true,
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
};

export default config;