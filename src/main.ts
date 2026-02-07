#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { ExecutorFactory } from './core/executor';
import { FeishuBot } from './platforms/feishu-bot';
import { BaseBot } from './platforms/base-bot';
import { Dashboard } from './ui/dashboard';
import * as readline from 'readline';
import { execSync } from 'child_process';

const rootDir = path.join(__dirname, '..');

// ---------------------------------------------------------
// MAIN RUN FLOW
// ---------------------------------------------------------

async function main() {
    let configPath = path.join(process.cwd(), 'config.json');
    if (!fs.existsSync(configPath)) configPath = path.join(rootDir, 'config.json');

    if (!fs.existsSync(configPath)) {
        console.error(chalk.red("❌ No config.json found."));
        console.error("👉 Run 'agent-social register' to get started.");
        process.exit(1);
    }

    const PROJECT_ROOT = process.cwd();
    let rawConfig: any;
    try {
        rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e: any) {
        console.error(chalk.red("❌ Failed to parse config.json:"), e.message);
        process.exit(1);
    }

    const appConfigs = Array.isArray(rawConfig) ? rawConfig : (rawConfig.apps || [rawConfig]);

    checkDependencies(appConfigs);

    // 显示仪表盘
    const appsWithStatus = appConfigs.map((c: any) => ({ ...c, status: 'starting' }));
    Dashboard.printBanner(appsWithStatus.length);

    const botInstances: BaseBot[] = [];
    const startupPromises: Promise<void>[] = [];

    for (let i = 0; i < appConfigs.length; i++) {
        const config = appConfigs[i];
        const platform = config.platform || 'feishu';
        const agentType = config.agent_type || 'gemini';
        
        const executor = ExecutorFactory.create(agentType, rootDir);
        
        let bot: BaseBot;
        if (platform === 'feishu') {
            bot = new FeishuBot(config, executor, PROJECT_ROOT);
        } else {
            appsWithStatus[i].status = 'error';
            continue;
        }

        const startup = bot.start().then(() => {
            appsWithStatus[i].status = 'online';
        }).catch((e) => {
            appsWithStatus[i].status = 'error';
            Dashboard.logEvent('ERR', `Bot ${config.app_id} failed to start: ${e.message}`);
        });

        startupPromises.push(startup);
        botInstances.push(bot);
    }

    // 等待所有启动任务完成
    await Promise.all(startupPromises);
    
    // 打印最终状态表格
    Dashboard.printTable(appsWithStatus);

    const cleanup = async () => {
        console.log("\nShutting down AgentSocial...");
        await Promise.all(botInstances.map(bot => bot.destroy()));
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

// ---------------------------------------------------------
// PRE-FLIGHT CHECK
// ---------------------------------------------------------

function checkDependencies(appConfigs: any[]) {
    const agentsToCheck = new Set(appConfigs.map(c => c.agent_type || 'gemini'));
    let missingAny = false;
    
    for (const agent of agentsToCheck) {
        try {
            const cmd = agent === 'claude' ? 'claude --version' : 
                        agent === 'codex' ? 'codex --version' : 'gemini --version';
            const version = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim();
            console.log(`[Check] ${agent} CLI found: ${version.substring(0, 20)}...`);
        } catch (e) {
            console.error(`\n❌ Error: Required agent '${agent}' is not installed.`);
            missingAny = true;
        }
    }
    if (missingAny) process.exit(1);
}

// ---------------------------------------------------------
// CLI ARGUMENT HANDLING
// ---------------------------------------------------------
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: agent-social [command]

Commands:
  register      Register a new App/Agent
  run           Start the agent service (default)
`);
    process.exit(0);
}

// ... runConfigWizard (省略以节省长度，逻辑保持不变) ...
async function runConfigWizard(): Promise<any> {
    const agents = [
        { id: 'gemini', name: 'Google Gemini CLI', check: 'gemini --version' },
        { id: 'claude', name: 'Claude Code', check: 'claude --version' },
        { id: 'codex', name: 'Codex CLI', check: 'codex --version' }
    ];
    const installedAgents = agents.filter(a => {
        try { execSync(a.check, { stdio: 'ignore' }); return true; } catch (e) { return false; }
    });

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string) => new Promise<string>(r => rl.question(q, r));

    if (installedAgents.length === 0) {
        console.error("\n❌ No compatible CLI agents detected!");
        process.exit(1);
    }

    console.log("\nSelect an agent:");
    installedAgents.forEach((a, i) => console.log(`  ${i + 1}. ${a.name}`));
    const answer = await ask("Enter number [1]: ");
    const agent = installedAgents[parseInt(answer) - 1]?.id || installedAgents[0].id;

    console.log("\n--- Project & Feishu Config ---");
    const currentDir = process.cwd();
    const projectPathInput = await ask(`Project path (default: ${currentDir}): `);
    const projectPath = projectPathInput.trim() || currentDir;

    const appId = await ask("App ID: ");
    const appSecret = await ask("App Secret: ");

    rl.close();
    return { 
        "platform": "feishu", 
        "app_id": appId.trim(), 
        "app_secret": appSecret.trim(), 
        "agent_type": agent, 
        "project_path": projectPath
    };
}

if (args.includes('register')) {
    (async () => {
        const targetPath = path.join(process.cwd(), 'config.json');
        let configArray = fs.existsSync(targetPath) ? JSON.parse(fs.readFileSync(targetPath, 'utf8')) : [];
        configArray.push(await runConfigWizard());
        fs.writeFileSync(targetPath, JSON.stringify(configArray, null, 2));
        process.exit(0);
    })();
} else {
    main();
}
