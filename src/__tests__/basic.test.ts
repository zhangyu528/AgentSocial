describe('AgentSocial 基础逻辑测试', () => {
    it('应当能正确解析一个简单的测试（冒烟测试）', () => {
        const sum = (a: number, b: number) => a + b;
        expect(sum(1, 2)).toBe(3);
    });

    // it('故意失败的用例：用于验证 Agent 反馈环', () => {
    //   expect(1 + 1).toBe(3);
    // });
});
