class AgentReporter {
    constructor(globalConfig, options) {
        this._globalConfig = globalConfig;
        this._options = options;
    }

    onRunComplete(contexts, results) {
        if (results.numFailedTests > 0) {
            console.log('\n\n' + '='.repeat(20));
            console.log('🤖 AGENT_FEEDBACK_START');
            console.log('测试失败，发现以下问题：\n');

            results.testResults.forEach(suite => {
                suite.testResults.forEach(test => {
                    if (test.status === 'failed') {
                        console.log(`### ❌ 失败用例: ${test.fullName}`);
                        console.log(`**所在文件**: ${suite.testFilePath}`);
                        console.log('\n**错误详情**:');
                        console.log('```text');
                        console.log(test.failureMessages.join('\n'));
                        console.log('```\n');
                    }
                });
            });

            console.log('\n**建议操作**: 如果你是 AI Agent，请优先检查上述失败文件的逻辑。你可以尝试运行 `npm test` 复现，并根据 Error Stack 进行修复。');
            console.log('🤖 AGENT_FEEDBACK_END');
            console.log('='.repeat(20) + '\n');
        }
    }
}

module.exports = AgentReporter;
