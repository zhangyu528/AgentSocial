#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { ExecutorFactory } from './core/executor';
import { FeishuBot } from './platforms/feishu-bot';
import { BaseBot } from './platforms/base-bot';
import { Dashboard } from './ui/dashboard';
import { FeishuAPI } from './services/feishu-api';
import * as readline from 'readline';
import { execSync } from 'child_process';

const rootDir = path.join(__dirname, '..');

// ---------------------------------------------------------
// MAIN RUN FLOW
// ---------------------------------------------------------

async function main() {
    const configDir = path.join(os.homedir(), '.agentsocial');
    const settingsPath = path.join(configDir, 'settings.json');

    if (!fs.existsSync(settingsPath)) {
        console.error(chalk.red("❌ No settings.json found."));
        console.error("👉 Run 'agentsocial setup' to get started.");
        process.exit(1);
    }

    const PROJECT_ROOT = process.cwd();
    let rawConfig: any;
    try {
        rawConfig = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (e: any) {
        console.error(chalk.red("❌ Failed to parse settings.json:"), e.message);
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
        const agentType = config.agent_type || 'gemini cli';

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

    if (appsWithStatus.some((a: any) => a.status === 'online')) {
        console.log(chalk.bold.green('✨ 机器人启动成功！你现在应该能在飞书接收到机器人的上线通知卡片。\n'));
    }

    console.log(chalk.bold.yellow('👉 如何开始使用：'));
    console.log(chalk.white('   1. 直接私聊：您可以直接在此对话框输入指令，无需 @ 机器人。'));
    console.log(chalk.white('   2. 拉我入群：将我拉入您的项目群，并通过 @我 的方式下达指令。'));
    console.log(chalk.white('   3. 任务审批：我会先回传执行计划，待您点击“批准”按钮后我将正式动工。\n'));

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
    const agentsToCheck = new Set(appConfigs.map(c => c.agent_type || 'gemini cli'));
    let missingAny = false;

    for (const agent of agentsToCheck) {
        try {
            // Check installation
            const cmd = agent === 'gemini cli' ? 'gemini --version' :
                agent === 'claude' ? 'claude --version' :
                    agent === 'codex' ? 'codex --version' : 'gemini --version';
            const version = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim();

            // Check login status for Gemini
            if (agent === 'gemini cli') {
                execSync('gemini --list-sessions', { stdio: 'ignore' });
            }

            console.log(`[Check] ${agent} CLI found and authenticated: ${version.substring(0, 20)}...`);
        } catch (e) {
            console.error(`\n❌ Error: Required agent '${agent}' is not installed or not authenticated.`);
            if (agent === 'gemini cli') {
                console.error(`   👉 Please run 'gemini' in your terminal and complete login.`);
            }
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
Usage: agentsocial [command]

Commands:
  setup         Configure and verify a new App/Agent
  run           Start the agent service (default)
`);
    process.exit(0);
}

async function runConfigWizard(): Promise<any> {
    console.clear();
    console.log(chalk.cyan.bold(`
    ╔════════════════════════════════════════════════════════════╗
    ║                                                            ║
    ║                🚀 Welcome to AgentSocial                   ║
    ║                                                            ║
    ║      Give your AI Agents a Social Identity on Feishu       ║
    ║                                                            ║
    ╚════════════════════════════════════════════════════════════╝
    `));

    const agents = [
        { id: 'gemini cli', name: 'Google Gemini CLI', check: 'gemini --version', loginCheck: 'gemini --list-sessions', available: false, installCmd: 'npm install -g @google/gemini-cli', desc: 'Advanced reasoning & tool use' },
        { id: 'claude', name: 'Claude Code', available: false, desc: 'Coming soon...' },
        { id: 'codex', name: 'Codex CLI', available: false, desc: 'Coming soon...' }
    ];

    console.log(chalk.cyan(`\n 🔍 Detecting environment...`));
    // Only detect Gemini for now as it's the only supported one
    try {
        execSync(agents[0].check || '', { stdio: 'ignore' });
        agents[0].available = true;
    } catch (e) {
        agents[0].available = false;
    }

    if (!agents[0].available) {
        console.log(chalk.red("\n ❌ Google Gemini CLI not found on your system."));
        console.log(chalk.yellow("\n To use AgentSocial, please install Gemini CLI:"));
        console.log(chalk.white(`  • ${chalk.bold(agents[0].name)}: ${chalk.cyan(agents[0].installCmd)}`));
        console.log("");
        process.exit(1);
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string) => new Promise<string>(r => rl.question(q, r));

    console.log(chalk.bold.white(" 🤖 Select your AI Core:"));
    console.log(chalk.gray(" ────────────────────────────────────────────────────────────"));

    agents.forEach((a, i) => {
        const index = i + 1;
        if (a.available) {
            console.log(`  ${chalk.green.bold(index + '.')} ${chalk.white.bold(a.name.padEnd(25))} ${chalk.dim('│')} ${chalk.green(a.desc)}`);
        } else {
            console.log(chalk.gray(`  ${index}. ${a.name.padEnd(25)} ${chalk.dim('│')} ${a.desc} (Coming soon...)`));
        }
    });
    console.log(chalk.gray(" ────────────────────────────────────────────────────────────\n"));

    let choice = 0;
    let selectedAgent = agents[0];

    while (true) {
        const answer = await ask(chalk.bold.cyan(` ⌨️  Select agent [1-${agents.length}]: `));
        choice = parseInt(answer) || 1;
        if (choice >= 1 && choice <= agents.length) {
            selectedAgent = agents[choice - 1];
            if (selectedAgent.available) break;
            console.log(chalk.red(`  ❌ ${selectedAgent.name} is not installed. Please choose an available one.`));
        } else {
            console.log(chalk.red(`  ❌ Invalid choice. Please enter 1 to ${agents.length}.`));
        }
    }

    const agent = selectedAgent.id;
    console.log(chalk.green(`\n ✅ Using ${selectedAgent.name}`));

    // Login status check for Gemini
    if (selectedAgent.id === 'gemini cli' && selectedAgent.loginCheck) {
        process.stdout.write(chalk.dim(`    • Checking authentication... `));
        try {
            execSync(selectedAgent.loginCheck, { stdio: 'ignore' });
            console.log(chalk.green("Logged in."));
        } catch (e) {
            console.log(chalk.red("Not logged in."));
            console.error(chalk.red(`\n❌ Error: ${selectedAgent.name} requires authentication.`));
            console.log(chalk.yellow(`👉 Please run 'gemini' in your terminal to login first.`));
            process.exit(1);
        }
    }

    console.log(chalk.bold.white("\n ⚙️  Project & Feishu Credentials:"));
    console.log(chalk.gray(" ────────────────────────────────────────────────────────────"));

    const currentDir = process.cwd();
    const projectPathInput = await ask(chalk.white(`   📂 Project path (default: ${currentDir}): `));
    const projectPath = projectPathInput.trim() || currentDir;

    const appId = await ask(chalk.white("   🆔 App ID: "));
    const appSecret = await ask(chalk.white("   🔑 App Secret: "));
    console.log(chalk.gray(" ────────────────────────────────────────────────────────────"));

    console.log(chalk.bold.yellow('\n 🚧 Action Required: Configure Feishu Developer Console'));
    console.log(chalk.gray(' ────────────────────────────────────────────────────────────'));
    console.log(chalk.white.bold('  1. Enable Bot Capability:'));
    console.log(chalk.dim('     • Navigate to "App Capabilities" -> "Bot"'));
    console.log(chalk.dim('     • Click "Enable Bot"'));

    console.log(chalk.white.bold('\n  2. Permission Management (Required Scopes):'));
    console.log(chalk.dim('     • 获取单聊、群组消息 (im:message:readonly)'));
    console.log(chalk.dim('     • 读取用户发给机器人的单聊消息 (im:message.p2p_msg:readonly)'));
    console.log(chalk.dim('     • 接收群聊中@机器人消息事件 (im:message.group_at_msg:readonly)'));
    console.log(chalk.dim('     • 以应用的身份发送消息 (im:message:send_as_bot)'));
    console.log(chalk.dim('     • 获取应用信息 (admin:app.info:readonly)'));
    console.log(chalk.dim('     • 获取群组信息 (im:chat:readonly)'));

    console.log(chalk.white.bold('\n  3. Events & Callbacks:'));
    console.log(chalk.dim('     • Events: Add "Receive Message" (im.message.receive_v1)'));
    console.log(chalk.dim('     • Callbacks: Enable "Card Action" (card.action.trigger)'));
    console.log(chalk.italic.gray('       * Note: WebSocket mode is used; no request URL is needed.'));

    console.log(chalk.white.bold('\n  4. Final Step:'));
    console.log(chalk.dim('     • Create and Publish a new version to apply changes.'));
    console.log(chalk.gray(' ────────────────────────────────────────────────────────────'));

    await ask(chalk.bold.cyan('\n 👉 Press [Enter] to start verification after you finish the setup... '));

    console.log(chalk.cyan("\n 🔍 Verifying Feishu Configuration..."));
    const api = new FeishuAPI(appId.trim(), appSecret.trim());
    const report = await api.diagnose();

    console.log(chalk.gray(" ────────────────────────────────────────────────────────────"));
    report.forEach(item => {
        const icon = item.status ? chalk.green("  ✅") : chalk.red("  ❌");
        const statusText = item.status ? chalk.green("Passed") : chalk.red("Failed");
        console.log(`${icon} ${chalk.bold(item.name.padEnd(50))} ${statusText}`);
        if (!item.status) {
            if (item.error) console.log(chalk.red(`     └─ Error: ${item.error}`));
            if (item.hint) console.log(chalk.gray(`     └─ Hint: ${item.hint}`));
        }
    });

    console.log(chalk.gray(" ────────────────────────────────────────────────────────────\n"));

    console.log(chalk.yellow(" ⚠️  Please manually confirm these (cannot be auto-probed):"));
    console.log(chalk.dim("   □ 应用可用范围：确保在“权限管理”最下方已设置“全部成员”或指定成员"));
    console.log(chalk.dim("   □ 事件订阅：确保已添加“接收消息”事件 (im.message.receive_v1)"));
    console.log(chalk.dim("   □ 回调配置：确保已启用“消息卡片操作”回调 (card.action.trigger)"));
    console.log(chalk.dim("   □ 读取用户发给机器人的单聊消息 (im:message.p2p_msg:readonly)"));
    console.log(chalk.dim("   □ 接收群聊中@机器人消息事件 (im:message.group_at_msg:readonly)"));
    console.log(chalk.dim("   □ 以应用的身份发送消息 (im:message:send_as_bot)"));
    console.log(chalk.gray(" ────────────────────────────────────────────────────────────\n"));

    const isConfirmed = report.every(r => r.status) || (await ask("配置检查未完全通过，是否仍要继续保存？[y/N]: ")).toLowerCase() === 'y';
    if (!isConfirmed) {
        console.log(chalk.yellow("已取消注册。"));
        process.exit(0);
    }

    rl.close();
    return {
        "platform": "feishu",
        "app_id": appId.trim(),
        "app_secret": appSecret.trim(),
        "agent_type": agent,
        "project_path": projectPath
    };
}

if (args.includes('setup')) {
    (async () => {
        const configDir = path.join(os.homedir(), '.agentsocial');
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
        const targetPath = path.join(configDir, 'settings.json');
        let configArray = fs.existsSync(targetPath) ? JSON.parse(fs.readFileSync(targetPath, 'utf8')) : [];
        const newApp = await runConfigWizard();
        configArray.push(newApp);
        fs.writeFileSync(targetPath, JSON.stringify(configArray, null, 2));

        console.log(chalk.bold.green('\n 🎉 Configuration Complete! saved to ~/.agentsocial/settings.json'));
        console.log(chalk.cyan(' 👉 Run "npm run dev" to start your agent.\n'));
        process.exit(0);
    })();
} else {
    main();
}
