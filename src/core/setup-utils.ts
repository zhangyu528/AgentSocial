import { execSync } from 'child_process';

export interface AgentInfo {
    id: string;
    name: string;
    check: string;
    loginCheck?: string;
    available: boolean;
    installCmd: string;
    desc: string;
}

export const SUPPORTED_AGENTS: AgentInfo[] = [
    {
        id: 'gemini cli',
        name: 'Google Gemini CLI',
        check: 'gemini --version',
        loginCheck: 'gemini --list-sessions',
        available: false,
        installCmd: 'npm install -g @google/gemini-cli',
        desc: 'Advanced reasoning & tool use'
    },
    { id: 'claude', name: 'Claude Code', available: false, check: 'claude --version', installCmd: 'npm install -g @anthropic/claude-code', desc: 'Coming soon...' },
    { id: 'codex', name: 'Codex CLI', available: false, check: 'codex --version', installCmd: 'npm install -g @codex/cli', desc: 'Coming soon...' }
];

/**
 * Detects if a specific agent is installed on the system
 */
export function detectAgent(agent: AgentInfo): boolean {
    try {
        execSync(agent.check, { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Checks if the agent is authenticated (if supported)
 */
export function checkAuth(agent: AgentInfo): boolean {
    if (!agent.loginCheck) return true;
    try {
        execSync(agent.loginCheck, { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}
