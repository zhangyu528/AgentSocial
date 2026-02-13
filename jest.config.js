module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.ts'],
    reporters: [
        'default',
        ['./tests/utils/agent-reporter.js', {}]
    ],
    verbose: true
};
