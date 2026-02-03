import * as fs from 'fs';
import * as path from 'path';
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
}

const message = process.argv[2];

if (!message) {
    console.error("Error: Please provide a message to send.");
    console.log("Usage: ts-node src/notify.ts \"Your message here\"");
    process.exit(1);
}

// ---------------------------------------------------------
// EXECUTION
// ---------------------------------------------------------

(async () => {
    try {
        if (!config.app_id || !config.app_secret) {
            throw new Error("Missing app_id or app_secret in config.json");
        }

        const api = new FeishuAPI(config.app_id, config.app_secret);

        if (config.receive_id) {
            // Case 1: Manual configuration
            await api.sendMessage(config.receive_id, config.receive_id_type || 'chat_id', `[Gemini CLI] ${message}`);
            console.log(`✅ Notification sent to configured chat: ${config.receive_id}`);
        } else {
            // Case 2: Auto-discovery
            console.log("🔍 No receive_id found in config. Starting auto-discovery...");
            const chatsRes = await api.getJoinedChats();
            const chats = chatsRes.data?.items || [];

            if (chats.length === 0) {
                console.warn("⚠️ Bot has not joined any chats. Please add the bot to a group first.");
                process.exit(0);
            }

            console.log(`📡 Sending notification to ${chats.length} chat(s)...`);
            for (const chat of chats) {
                await api.sendMessage(chat.chat_id, 'chat_id', `[Gemini CLI] ${message}`);
                console.log(`   - Sent to: ${chat.name || chat.chat_id}`);
            }
            console.log("✅ All notifications sent successfully.");
        }
    } catch (error: any) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
})();
