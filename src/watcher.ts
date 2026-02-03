import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { FeishuAPI } from './feishu-api';

// ---------------------------------------------------------
// CONFIGURATION LOAD
// ---------------------------------------------------------
const rootDir = path.join(__dirname, '..');
const configPath = path.join(rootDir, 'config.json');
let config: any = {};

try {
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
} catch (error: any) {
    console.error("Error reading config.json:", error.message);
    process.exit(1);
}

const api = new FeishuAPI(config.app_id, config.app_secret);
const POLL_INTERVAL = 5000;
const statePath = path.join(rootDir, '.state.json');

interface ChatCursor {
    lastMessageId: string | null;
    lastMessageIdTime: number;
}

let globalState: { chat_cursors: Record<string, ChatCursor> } = { chat_cursors: {} };

// ---------------------------------------------------------
// STATE MANAGEMENT
// ---------------------------------------------------------

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
// MAIN LOOP
// ---------------------------------------------------------

async function pollChat(chatId: string) {
    if (!globalState.chat_cursors[chatId]) {
        globalState.chat_cursors[chatId] = { lastMessageId: null, lastMessageIdTime: 0 };
    }
    const cs = globalState.chat_cursors[chatId];

    const res = await api.getMessages(chatId, 10);

    if (res.code === 0 && res.data && res.data.items) {
        const messages = res.data.items.reverse(); // Process oldest to newest

        for (const msg of messages) {
            // Skip system messages, non-text messages, or messages already processed
            if (msg.msg_type !== 'text' || msg.sender.sender_type !== 'user') continue;
            if (cs.lastMessageId && msg.create_time <= cs.lastMessageIdTime) continue;
            if (cs.lastMessageId === msg.message_id) continue;

            let content = JSON.parse(msg.body.content).text;

            // Strip @mentions
            content = content.replace(/^@[^ ]+\s+/, '').trim();

            if (!content) continue;

            console.log(`[Poll] New command received: ${content} (Chat ID: ${chatId})`);

            await handleCommand(content, chatId);

            cs.lastMessageId = msg.message_id;
            cs.lastMessageIdTime = msg.create_time;
            saveState();
        }

        // If first run, just set the watermark to latest to avoid flood
        if (!cs.lastMessageId && messages.length > 0) {
            cs.lastMessageId = messages[messages.length - 1].message_id;
            cs.lastMessageIdTime = messages[messages.length - 1].create_time;
            saveState();
        }
    }
}

async function poll() {
    try {
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
                console.error(`[Watcher Chat ${chatId} Error] ${err.message}`);
            }
        }
    } catch (error: any) {
        console.error(`[Watcher Global Error] ${error.message}`);
    }

    setTimeout(poll, POLL_INTERVAL);
}

async function handleCommand(cmd: string, chatId: string) {
    // Escape double quotes for shell command
    const escapedCmd = cmd.replace(/"/g, '\\"');
    const geminiCmd = `gemini --yolo -p "${escapedCmd}"`;

    console.log(`Executing: ${geminiCmd}`);

    await api.sendMessage(chatId, 'chat_id', `[Gemini CLI] 收到指令: "${cmd}"，正在以 YOLO 模式处理...`);

    exec(geminiCmd, (error, stdout, stderr) => {
        const result = error ? `❌ 错误:\n${stderr || error.message}` : `✅ 结果:\n${stdout}`;
        api.sendMessage(chatId, 'chat_id', `[Gemini CLI] ${result}`);
    });
}

loadState();
console.log(`🚀 AgentSocial Watcher started. Mode: ${config.receive_id ? 'Single-Chat' : 'Multi-Chat'}`);
poll();
