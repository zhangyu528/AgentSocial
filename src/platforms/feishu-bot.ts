import { BaseBot } from './base-bot';
import { FeishuAPI } from '../services/feishu-api';
import { IAgentExecutor } from '../core/executor';
import * as lark from '@larksuiteoapi/node-sdk';
import * as path from 'path';

export class FeishuBot extends BaseBot {
    private api: FeishuAPI;
    private botOpenId: string | null = null;
    private botName: string | null = null;

    constructor(config: any, executor: IAgentExecutor, defaultRoot: string) {
        super(config, executor, defaultRoot);
        this.api = new FeishuAPI(config.app_id, config.app_secret);
    }

    async start() {
        try {
            const botInfo = await this.api.getBotInfo();
            this.botOpenId = botInfo.open_id;
            this.botName = botInfo.app_name;

            const wsClient = new lark.WSClient({
                appId: this.config.app_id,
                appSecret: this.config.app_secret,
                logger: {
                    error: () => {},
                    warn: () => {},
                    info: () => {},
                    debug: () => {},
                    trace: () => {}
                }
            });

            wsClient.start({
                eventDispatcher: new lark.EventDispatcher({}).register({
                    'im.message.receive_v1': async (data) => this.onMessage(data)
                })
            });

            console.log(`[Feishu] Bot Started: ${this.botName}`);

            // 3. 预热启动: 提前拉起 Gemini 进程
            console.log(`[Feishu] Pre-warming agent process for ${this.appId}...`);
            this.executor.run({
                appId: this.appId,
                chatId: "internal-prewarm",
                command: "echo 'Agent ready'",
                projectRoot: this.projectRoot,
                sandbox: this.config.sandbox
                // 不传入 onStdout/onStderr 回调，确保静默
            }).then(() => console.log(`[Feishu] Agent pre-warmed for ${this.appId}`))
              .catch(e => console.error(`[Feishu Warning] Pre-warm failed: ${e.message}`));

            // 平台特定的上线通知
            await this.broadcastCard(this.createOnlineCard());

        } catch (error: any) {
            console.error(`[Feishu Error] ${this.appId}: ${error.message}`);
        }
    }

    async stop() {
        await this.broadcastCard(this.createOfflineCard());
        console.log(`[Feishu] Bot ${this.appId} stopped.`);
    }

    private createOnlineCard() {
        const info = this.getStatusInfo();
        return {
            header: { title: { content: "🚀 AgentSocial 已上线", tag: "plain_text" }, template: "wathet" },
            elements: [
                { tag: "div", text: { content: `**机器人:** ${this.botName}\n**项目:** ${info.projectName}\n**模式:** ${info.agentType}`, tag: "lark_md" } },
                { tag: "note", elements: [{ tag: "plain_text", content: `时间: ${info.time}` }] }
            ]
        };
    }

    private createOfflineCard() {
        const info = this.getStatusInfo();
        return {
            header: { title: { content: "📴 AgentSocial 已下线", tag: "plain_text" }, template: "grey" },
            elements: [
                { tag: "div", text: { content: `**机器人:** ${this.botName || this.appId}\n**项目:** ${info.projectName}`, tag: "lark_md" } }
            ]
        };
    }

    /**
     * Implementation of required abstract methods
     */
    protected async sendReply(chatId: string, message: string): Promise<void> {
        await this.api.sendMessage(chatId, 'chat_id', message);
    }

    protected async sendProactive(chatId: string, message: string): Promise<void> {
        await this.api.sendMessage(chatId, 'chat_id', `📢 [主动通知]\n${message}`);
    }

    private async broadcastCard(card: any) {
        try {
            const joinedChats = await this.api.getJoinedChats();
            const ids = (joinedChats.data?.items || []).map((c: any) => c.chat_id);
            for (const id of ids) await this.api.sendCard(id, 'chat_id', card);
        } catch (e) {}
    }

    private async onMessage(data: any) {
        const message = data.message;
        if (!message || message.message_type !== 'text') return;

        const mentions = message.mentions || [];
        const isMentioned = mentions.some((m: any) => {
            const mId = (typeof m.id === 'object') ? m.id.open_id : m.id;
            return mId === this.botOpenId || mId === this.appId;
        });
        const isDirect = message.chat_type === 'p2p';

        if (isDirect || isMentioned) {
            let content = JSON.parse(message.content).text;
            // Clean mentions
            mentions.forEach((m: any) => {
                const mId = (typeof m.id === 'object') ? m.id.open_id : m.id;
                if (mId === this.botOpenId || mId === this.appId) content = content.replace(m.key, '');
            });

            // Call the base class logic
            await this.handleIncomingCommand(message.chat_id, content.trim());
        }
    }
}