import { BaseBot } from './base-bot';
import { FeishuAPI } from '../services/feishu-api';
import { IAgentExecutor } from '../core/executor';
import { Dashboard } from '../ui/dashboard';
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
                    error: () => { },
                    warn: () => { },
                    info: () => { },
                    debug: () => { },
                    trace: () => { }
                }
            });

            wsClient.start({
                eventDispatcher: new lark.EventDispatcher({}).register({
                    'im.message.receive_v1': async (data) => this.onMessage(data),
                    'card.action.trigger': async (data: any) => {
                        Dashboard.logEvent('SYS', `[Card Click] Raw Data: ${JSON.stringify(data)}`);

                        const actionId = data.action?.value?.action_id;
                        const chatId = data.action?.value?.chat_id;
                        const messageId = data.context?.open_message_id;
                        const originalCmd = data.action?.value?.original_cmd;
                        const prompt = data.action?.value?.prompt;

                        if (messageId && chatId) {
                            let cardToUpdate;
                            if (actionId === 'approve') {
                                this.approve(chatId);
                                cardToUpdate = this.createOperatedCard("⚠️ 敏感操作审批 (已批准)", `**操作:**\n${prompt || '未知操作'}`, "✅ 已批准", "green");
                            } else if (actionId === 'deny') {
                                this.deny(chatId);
                                const summary = prompt ? `**操作:**\n${prompt}` : `**目标:** ${originalCmd || '未知指令'}`;
                                cardToUpdate = this.createOperatedCard("🚫 操作已取消", summary, "❌ 已拒绝/取消", "grey");
                            } else if (actionId === 'execute_plan' && originalCmd) {
                                this.executePlan(chatId, originalCmd);
                                cardToUpdate = this.createOperatedCard("📋 执行计划 (已确认)", `**目标:** ${originalCmd}`, "🚀 正在后台执行...", "green");
                            }

                            if (cardToUpdate) {
                                // 异步更新，避开同步响应的冲突
                                setTimeout(() => {
                                    this.api.updateCard(messageId, cardToUpdate).catch(e => {
                                        Dashboard.logEvent('ERR', `Async Card Update Failed: ${e.message}`);
                                    });
                                }, 300);
                            }
                        }

                        // 同步只返回 toast，避免报错 code
                        return {
                            toast: { type: "info", content: "指令已确认，处理中..." }
                        };
                    }
                })
            });

            Dashboard.logEvent('SYS', `[Feishu] Bot Started: ${this.botName}`);

            // 3. 预热启动: 通过标准入口拉起进程，使用内部ID保持静默
            Dashboard.logEvent('SYS', `[Feishu] Pre-warming agent process...`);
            // Pre-warm uses 'auto' mode implicitly via base class if we called super, 
            // but here we might want to just let it be. 
            // Since we override handleIncomingCommand, we need to be careful.
            // But pre-warm is 'internal-prewarm', which we can filter.

            // 平台特定的上线通知
            await this.broadcastCard(this.createOnlineCard());

        } catch (error: any) {
            Dashboard.logEvent('ERR', `[Feishu Error] ${this.appId}: ${error.message}`);
        }
    }

    async stop() {
        await this.broadcastCard(this.createOfflineCard());
        Dashboard.logEvent('SYS', `[Feishu] Bot ${this.appId} stopped.`);
    }

    // ... createOnlineCard ... createOfflineCard ... (Unchanged, so not including in replacement if possible, but replace_file_content needs contiguous block. I'll include them if needed or skip if I can target start/end line precisely)
    // Actually, I'll just replace the whole class body from start() downwards to end of file to be safe and easiest.

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

    private createOperatedCard(title: string, content: string, status: string, template: string = 'grey') {
        const safeContent = content.length > 500 ? content.substring(0, 497) + '...' : content;
        return {
            config: { wide_screen_mode: true },
            header: {
                title: { content: title, tag: "plain_text" },
                template: template
            },
            elements: [
                {
                    tag: "div",
                    text: { content: safeContent, tag: "lark_md" }
                },
                {
                    tag: "note",
                    elements: [{ tag: "plain_text", content: `状态: ${status}` }]
                }
            ]
        };
    }

    protected async sendApprovalCard(chatId: string, prompt: string): Promise<void> {
        const card = {
            config: { wide_screen_mode: true },
            header: { title: { content: "⚠️ 敏感操作审批", tag: "plain_text" }, template: "orange" },
            elements: [
                { tag: "div", text: { content: `**Agent 申请执行操作:**\n\`\`\`\n${prompt}\n\`\`\``, tag: "lark_md" } },
                {
                    tag: "action",
                    actions: [
                        {
                            tag: "button",
                            text: { tag: "plain_text", content: "✅ 批准执行" },
                            type: "primary",
                            value: { action_id: "approve", chat_id: chatId, prompt: prompt }
                        },
                        {
                            tag: "button",
                            text: { tag: "plain_text", content: "❌ 拒绝" },
                            type: "danger",
                            value: { action_id: "deny", chat_id: chatId, prompt: prompt }
                        }
                    ]
                }
            ]
        };
        await this.api.sendCard(chatId, 'chat_id', card).catch(e =>
            Dashboard.logEvent('ERR', `Failed to send approval card: ${e.message}`)
        );
    }

    protected async sendPlanCard(chatId: string, originalCmd: string, plan: string): Promise<void> {
        const card = {
            config: { wide_screen_mode: true },
            header: { title: { content: "📋 执行计划确认", tag: "plain_text" }, template: "blue" },
            elements: [
                { tag: "div", text: { content: `**目标:** ${originalCmd}`, tag: "lark_md" } },
                { tag: "hr" },
                { tag: "div", text: { content: `**拟定计划:**\n${plan}`, tag: "lark_md" } },
                {
                    tag: "action",
                    actions: [
                        {
                            tag: "button",
                            text: { tag: "plain_text", content: "🚀 批准并自动执行" },
                            type: "primary",
                            value: { action_id: "execute_plan", chat_id: chatId, original_cmd: originalCmd }
                        },
                        {
                            tag: "button",
                            text: { tag: "plain_text", content: "❌ 取消" },
                            type: "default",
                            value: { action_id: "deny", chat_id: chatId, original_cmd: originalCmd }
                        }
                    ]
                }
            ]
        };
        await this.api.sendCard(chatId, 'chat_id', card).catch(e =>
            Dashboard.logEvent('ERR', `Failed to send plan card: ${e.message}`)
        );
    }

    protected async sendReply(chatId: string, message: string): Promise<void> {
        await this.api.sendMessage(chatId, 'chat_id', message);
    }

    protected async sendResultCard(chatId: string, originalCmd: string, result: string, isSuccess: boolean): Promise<void> {
        const card = {
            config: { wide_screen_mode: true },
            header: { 
                title: { content: isSuccess ? "✅ 执行成功" : "❌ 执行失败", tag: "plain_text" }, 
                template: isSuccess ? "green" : "red" 
            },
            elements: [
                { tag: "div", text: { content: `**目标:** ${originalCmd}`, tag: "lark_md" } },
                { tag: "hr" },
                { 
                    tag: "div", 
                    text: { 
                        content: result.length > 3000 ? result.substring(0, 2900) + "\n\n... (输出过长已截断)" : result, 
                        tag: "lark_md" 
                    } 
                }
            ]
        };
        await this.api.sendCard(chatId, 'chat_id', card).catch(e =>
            Dashboard.logEvent('ERR', `Failed to send result card: ${e.message}`)
        );
    }

    protected async sendProactive(chatId: string, message: string): Promise<void> {
        await this.api.sendMessage(chatId, 'chat_id', `📢 [主动通知]\n${message}`);
    }

    private async broadcastCard(card: any) {
        try {
            const joinedChats = await this.api.getJoinedChats();
            const ids = (joinedChats.data?.items || []).map((c: any) => c.chat_id);
            for (const id of ids) await this.api.sendCard(id, 'chat_id', card);
        } catch (e) { }
    }

    protected async handleIncomingCommand(chatId: string, content: string, messageId?: string) {
        if (chatId === 'internal-prewarm') return;

        if (messageId) {
            if (this.processedMessageIds.has(messageId)) return;
            this.processedMessageIds.add(messageId);
            if (this.processedMessageIds.size > 1000) {
                const it = this.processedMessageIds.values();
                this.processedMessageIds.delete(it.next().value!);
            }
        }

        const agentName = this.config.agent_type || 'Agent';
        await this.sendReply(chatId, `🤔 [${agentName}] 正在思考计划...`);

        try {
            // Stage 1: Generate Plan
            const result = await this.queue.enqueue(
                this.appId,
                chatId,
                content,
                this.projectRoot,
                this.config.sandbox,
                'plan'
            );

            // Stage 2: Send Card
            await this.sendPlanCard(chatId, content, result.stdout);

        } catch (error: any) {
            await this.sendReply(chatId, `❌ 计划生成失败: ${error.message}`);
        }
    }

    private async executePlan(chatId: string, content: string) {
        try {
            const result = await this.queue.enqueue(
                this.appId,
                chatId,
                content, // Re-run with same command but in auto mode
                this.projectRoot,
                this.config.sandbox,
                'auto',
                (data) => this.interceptProactiveMessages(chatId, data),
                (prompt) => this.sendApprovalCard(chatId, prompt)
            );

            if (result.code !== 0) {
                Dashboard.logEvent('ERR', `[Auto Execution Failed] Code: ${result.code}, Stderr: ${result.stderr}`);
            }

            const cleanOutput = result.stdout.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{4,4}g|(?:\d{1,4}(?:;\d{0,4})*)?[0-9,A-PR-Zcf-nqry=><])/g, '').trim();
            const errorOutput = result.stderr.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{4,4}g|(?:\d{1,4}(?:;\d{0,4})*)?[0-9,A-PR-Zcf-nqry=><])/g, '').trim();
            
            const isSuccess = result.code === 0;
            const output = isSuccess ? (cleanOutput || "✅ 执行完毕。") : `错误输出:\n${cleanOutput}\n\n${errorOutput}`;

            await this.sendResultCard(chatId, content, output, isSuccess);
        } catch (error: any) {
            await this.sendResultCard(chatId, content, `❌ 执行过程中出现异常: ${error.message}`, false);
        }
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

            // Call the base class logic -> Now overridden
            await this.handleIncomingCommand(message.chat_id, content.trim(), message.message_id);
        }
    }
}