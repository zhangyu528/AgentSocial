#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
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
    let configPath = path.join(process.cwd(), 'config.json');
    if (!fs.existsSync(configPath)) configPath = path.join(rootDir, 'config.json');

    if (!fs.existsSync(configPath)) {
        console.error(chalk.red("❌ No config.json found."));
        console.error("👉 Run 'agent-social setup' to get started.");
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

    if (appsWithStatus.some((a: any) => a.status === 'online')) {
        console.log(chalk.bold.green('✨ 机器人启动成功！你现在应该能在飞书接收到机器人的上线通知卡片。\n'));
    }

    console.log(chalk.bold.yellow('👉 下一步操作：'));
    console.log(chalk.white('   1. 在飞书管理后台确保机器人功能已开启。'));
    console.log(chalk.white('   2. 将机器人拉入飞书群组。'));
    console.log(chalk.white('   3. 在群里 @机器人 并发送指令（如：帮我写个 README）。\n'));

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
  setup         Configure and verify a new App/Agent
  run           Start the agent service (default)
`);
    process.exit(0);
}

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

    console.log(chalk.bold.yellow('\n🚧 请前往飞书开发者后台完成以下关键配置：'));
    console.log(chalk.cyan('------------------------------------------------------------'));
    console.log(chalk.white('1. 启用机器人能力：'));
    console.log('   - 在左侧菜单选择“应用功能” -> “机器人”，点击“启用机器人”。');
    console.log(chalk.white('\n2. 权限管理 (必须开启以下 6 项 Scopes)：'));
    console.log('   - 接收消息内容 (im:message:readonly)');
    console.log('   - 读取单聊消息 (im:message.p2p_msg:readonly)');
    console.log('   - 接收群聊中 @机器人消息 (im:message.group_at_msg:readonly)');
    console.log('   - 以机器人身份发送消息 (im:message:send_as_bot)');
    console.log('   - 获取群组信息 (im:chat:readonly)');
    console.log('   - 获取通讯录基本信息 (contact:contact.base:readonly)');
    console.log(chalk.white('\n2. 事件订阅与回调配置 (Events & Callbacks)：'));
    console.log('   - 事件订阅：添加 接收消息 (im.message.receive_v1)');
    console.log('   - 回调配置：启用 消息卡片操作 (card.action.trigger)');
    console.log(chalk.gray('     *注：本项目使用 WebSocket 长连接模式，无需在后台填写具体的请求网址。'));
    console.log(chalk.white('\n3. 记得发布一个新版本，权限和事件才会正式生效！'));
    console.log(chalk.cyan('------------------------------------------------------------'));

    await ask(chalk.bold.cyan('\n👉 请在后台完成上述配置后，按 [Enter] 键开始实时校验...'));

    console.log(chalk.cyan("\n🔍 正在校验飞书配置..."));
    const api = new FeishuAPI(appId.trim(), appSecret.trim());
    const report = await api.diagnose();
    
    console.log(chalk.white("------------------------------------------------------------"));
    report.forEach(item => {
        const icon = item.status ? chalk.green("✅") : chalk.red("❌");
        console.log(`${icon} ${chalk.bold(item.name)}: ${item.status ? 'OK' : chalk.red('Failed')}`);
        if (!item.status && item.hint) console.log(chalk.gray(`   👉 指引: ${item.hint}`));
    });
    console.log(chalk.white("------------------------------------------------------------\n"));

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
        const targetPath = path.join(process.cwd(), 'config.json');
        let configArray = fs.existsSync(targetPath) ? JSON.parse(fs.readFileSync(targetPath, 'utf8')) : [];
        const newApp = await runConfigWizard();
        configArray.push(newApp);
        fs.writeFileSync(targetPath, JSON.stringify(configArray, null, 2));
        
        console.log(chalk.bold.green('\n✅ 配置完成！配置已保存到 config.json'));
        console.log(chalk.cyan('------------------------------------------------------------'));
        console.log(chalk.bold.white('🚩 最终配置复核清单：'));
        console.log(chalk.yellow('\n1. 开启机器人能力：'));
        console.log('   - 确保在“应用功能” -> “机器人”中已点击“启用机器人”。');
        console.log(chalk.yellow('\n2. 权限管理 (必须开启以下 6 项 Scopes)：'));
        console.log('   - 接收消息内容 (im:message:readonly)');
        console.log('   - 读取单聊消息 (im:message.p2p_msg:readonly)');
        console.log('   - 接收群聊中 @机器人消息 (im:message.group_at_msg:readonly)');
        console.log('   - 以机器人身份发送消息 (im:message:send_as_bot)');
        console.log('   - 获取群组信息 (im:chat:readonly)');
        console.log('   - 获取通讯录基本信息 (contact:contact.base:readonly)');
        console.log(chalk.yellow('\n2. 事件订阅与回调 (必须配置项)：'));
        console.log('   - 事件订阅：添加 接收消息 (im.message.receive_v1)');
        console.log('   - 回调配置：启用 消息卡片操作 (card.action.trigger)');
        console.log(chalk.yellow('\n3. 发布应用：'));
        console.log('   - 必须发布一个新版本，上述所有权限和事件才会正式生效！');
        console.log(chalk.cyan('------------------------------------------------------------'));
        process.exit(0);
    })();
} else {
    main();
}