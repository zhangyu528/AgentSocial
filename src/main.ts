import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { FeishuAPI } from './feishu-api';

// ---------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------
const rootDir = path.join(__dirname, '..');
const configPath = path.join(rootDir, 'config.json');
const statePath = path.join(rootDir, '.state.json');
const POLL_INTERVAL = 2000;
const PROJECT_ROOT = path.resolve(rootDir, '../../..');

let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const api = new FeishuAPI(config.app_id, config.app_secret);

interface ChatState {
    lastMessageId: string | null;
    lastMessageIdTime: number;
    initialized: boolean;
}

let globalState: { chat_cursors: Record<string, ChatState> } = { chat_cursors: {} };
let botOpenId: string | null = null;

function loadState() {
    if (fs.existsSync(statePath)) {
        try {
            globalState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
            if (!globalState.chat_cursors) globalState.chat_cursors = {};
        } catch (e) { }
    }
}

function saveState() {
    fs.writeFileSync(statePath, JSON.stringify(globalState, null, 2));
}

// ---------------------------------------------------------
// EXECUTION
// ---------------------------------------------------------

function runGemini(escapedCmd: string, useResume: boolean, callback: (error: any, stdout: string, stderr: string) => void) {
    const cmd = `gemini --yolo ${useResume ? '--resume latest' : ''} -p "${escapedCmd}"`;
    console.log(`[Executing] ${cmd}`);
    exec(cmd, {
        cwd: PROJECT_ROOT,
        env: { ...process.env, OTEL_SDK_DISABLED: 'true' },
        maxBuffer: 1024 * 1024 * 10
    }, callback);
}

async function handleCommand(cmd: string, chatId: string) {
    console.log(`\n[Command] ${cmd} (Chat ID: ${chatId})`);
    if (cmd.toLowerCase() === 'ping') {
        await api.sendMessage(chatId, 'chat_id', "pong! Agent is alive.");
        return;
    }

    await api.sendMessage(chatId, 'chat_id', `⏳ 正在处理指令: "${cmd}"...`);

    const escapedCmd = cmd.replace(/"/g, '\\"');

    runGemini(escapedCmd, true, (error, stdout, stderr) => {
        if (error && (stderr.includes("No previous sessions found") || stderr.includes("Error resuming session"))) {
            console.log("[Retry] Session resume failed, starting new session...");
            runGemini(escapedCmd, false, (error2, stdout2, stderr2) => {
                finishCommand(error2, stdout2, stderr2, chatId);
            });
        } else {
            finishCommand(error, stdout, stderr, chatId);
        }
    });
}

function finishCommand(error: any, stdout: string, stderr: string, chatId: string) {
    let result = error ? `❌ 运行出错:\n${stderr || error.message}` : stdout.trim();
    if (!result) result = "✅ 执行完毕。";
    console.log(`[Output] ${result.substring(0, 50)}...`);
    api.sendMessage(chatId, 'chat_id', result).catch(err => console.error("Send back failed:", err));
}

// ---------------------------------------------------------
// MAIN LOOP
// ---------------------------------------------------------

async function pollChat(chatId: string) {
    if (!globalState.chat_cursors[chatId]) {
        globalState.chat_cursors[chatId] = { lastMessageId: null, lastMessageIdTime: 0, initialized: false };
    }
    const cs = globalState.chat_cursors[chatId];

    const res = await api.getMessages(chatId, 50);
    const items = res.data ? res.data.items || [] : [];
    const sorted = items.sort((a: any, b: any) => parseInt(a.create_time) - parseInt(b.create_time));

    if (!cs.initialized) {
        if (sorted.length > 0) {
            const latest = sorted[sorted.length - 1];
            cs.lastMessageId = latest.message_id;
            cs.lastMessageIdTime = parseInt(latest.create_time);
            saveState();
        }
        cs.initialized = true;
        console.log(`[Init] Chat ${chatId} ready.`);
    } else {
        for (const msg of sorted) {
            const msgTime = parseInt(msg.create_time);
            if (msgTime <= cs.lastMessageIdTime || msg.message_id === cs.lastMessageId) continue;
            cs.lastMessageId = msg.message_id;
            cs.lastMessageIdTime = msgTime;
            saveState();

            if (msg.msg_type !== 'text' || msg.sender.sender_type !== 'user') continue;
            let content = "";
            try { content = JSON.parse(msg.body.content).text; } catch (e) { continue; }

            const isMentioned = msg.mentions && msg.mentions.some((m: any) => m.id === botOpenId);
            if (isMentioned) {
                let cleaned = content;
                msg.mentions.forEach((m: any) => cleaned = cleaned.replace(m.key, ''));
                await handleCommand(cleaned.trim(), chatId);
            }
        }
    }
}

async function poll() {
    try {
        if (!botOpenId) {
            const bot = await api.getBotInfo();
            botOpenId = bot.open_id;
        }

        let chatsToPoll: string[] = [];
        if (config.receive_id) {
            chatsToPoll = [config.receive_id];
        } else {
            const joinedChats = await api.getJoinedChats();
            chatsToPoll = (joinedChats.data?.items || []).map((c: any) => c.chat_id);
        }

        for (const chatId of chatsToPoll) {
            try {
                await pollChat(chatId);
            } catch (err: any) {
                console.error(`[Poll Chat ${chatId} Error] ${err.message}`);
            }
        }

    } catch (error: any) {
        console.error(`[Global Poll Error] ${error.message}`);
    }
    setTimeout(poll, POLL_INTERVAL);
}

loadState();
console.log(`\n================================================`);
console.log(`🤖 AgentSocial (Multi-Platform Link)`);
console.log(`Root: ${PROJECT_ROOT}`);
console.log(`Mode: ${config.receive_id ? 'Single-Chat' : 'Multi-Chat Discovery'}`);
console.log(`================================================\n`);
poll();
