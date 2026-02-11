import { detectAgent, checkAuth, SUPPORTED_AGENTS } from '../core/setup-utils';
import { execSync } from 'child_process';

// Mock child_process
jest.mock('child_process', () => ({
    execSync: jest.fn()
}));

describe('Setup Utilities - Agent Detection', () => {
    const mockExecSync = execSync as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('如果执行 check 命令成功，应当返回 true (Agent 已安装)', () => {
        mockExecSync.mockReturnValue('v1.0.0');
        const gemini = SUPPORTED_AGENTS.find(a => a.id === 'gemini cli')!;

        const result = detectAgent(gemini);

        expect(result).toBe(true);
        expect(mockExecSync).toHaveBeenCalledWith(gemini.check, { stdio: 'ignore' });
    });

    it('如果执行 check 命令失败，应当返回 false (Agent 未安装)', () => {
        mockExecSync.mockImplementation(() => {
            throw new Error('command not found');
        });
        const gemini = SUPPORTED_AGENTS.find(a => a.id === 'gemini cli')!;

        const result = detectAgent(gemini);

        expect(result).toBe(false);
    });

    it('如果 loginCheck 命令成功，应当返回 true (已登录)', () => {
        mockExecSync.mockReturnValue('sessions listed');
        const gemini = SUPPORTED_AGENTS.find(a => a.id === 'gemini cli')!;

        const result = checkAuth(gemini);

        expect(result).toBe(true);
        expect(mockExecSync).toHaveBeenCalledWith(gemini.loginCheck, { stdio: 'ignore' });
    });

    it('如果 loginCheck 命令失败，应当返回 false (未登录)', () => {
        mockExecSync.mockImplementation(() => {
            throw new Error('not logged in');
        });
        const gemini = SUPPORTED_AGENTS.find(a => a.id === 'gemini cli')!;

        const result = checkAuth(gemini);

        expect(result).toBe(false);
    });

    it('对于没有 loginCheck 的 Agent，应当重默认返回 true', () => {
        const claude = SUPPORTED_AGENTS.find(a => a.id === 'claude')!;
        // claude currently has no loginCheck in setup-utils.ts (based on my previous write_to_file)

        const result = checkAuth(claude);

        expect(result).toBe(true);
        expect(mockExecSync).not.toHaveBeenCalled();
    });
});
