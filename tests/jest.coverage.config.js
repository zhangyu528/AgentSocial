const path = require('path');
const baseConfig = require('../jest.config.js');

module.exports = {
    ...baseConfig,
    rootDir: path.join(__dirname, '..'),
    reporters: [
        'default',
        [path.join(__dirname, './utils/agent-reporter.js'), {}]
    ],
    collectCoverage: true,
    collectCoverageFrom: ['src/**/*.ts'],
    coverageReporters: ['text', 'lcov', 'html'],
    coverageDirectory: 'coverage'
};
