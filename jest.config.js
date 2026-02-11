module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.ts'],
    reporters: [
        'default',
        ['./src/test-utils/agent-reporter.js', {}]
    ],
    verbose: true
};
