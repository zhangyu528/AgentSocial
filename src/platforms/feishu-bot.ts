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
            // 1. 凭证预检 (Credential & Network Pre-check)
            Dashboard.logEvent('SYS', `[Feishu] 正在验证凭证...`);
            let botInfo;
            try {
                botInfo = await this.api.getBotInfo();
            } catch (error: any) {
                if (error.message.includes('400') || error.message.includes('401') || error.message.includes('10003')) {
                    Dashboard.logEvent('ERR', `[Feishu] 启动失败: 飞书 App ID 或 App Secret 错误，请检查配置。`);
                } else {
                    Dashboard.logEvent('ERR', `[Feishu] 启动失败: 网络连接异常，无法访问飞书 API。`);
                }
                Dashboard.logEvent('ERR', `[Detail] ${error.message}`);
                setTimeout(() => process.exit(1), 500);
                return;
            }

            this.botOpenId = botInfo.open_id;
            this.botName = botInfo.app_name;

            const wsClient = new lark.WSClient({
                appId: this.config.app_id,
                appSecret: this.config.app_secret,
                loggerLevel: lark.LoggerLevel.error,
                logger: {
                    error: (msg: any) => Dashboard.logEvent('ERR', `[SDK] ${msg}`),
                    warn: () => { },
                    info: () => { },
                    debug: () => { },
                    trace: () => { }
                }
            });

            Dashboard.logEvent('SYS', `[Feishu] 凭证验证通过: ${this.botName}，正在建立连接...`);

            await wsClient.start({
                eventDispatcher: new lark.EventDispatcher({
                    loggerLevel: lark.LoggerLevel.error,
                    logger: {
                        error: (msg: any) => Dashboard.logEvent('ERR', `[SDK] ${msg}`),
                        warn: () => { },
                        info: () => { },
                        debug: () => { },
                        trace: () => { }
                    }
                }).register({
                    'im.message.receive_v1': async (data) => this.onMessage(data),
                    'card.action.trigger': async (data: any) => {
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
                                this.executePlan(chatId, originalCmd, messageId);
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

            // 3. 智能预热 (Intelligent Pre-warming)
            Dashboard.logEvent('SYS', `[Agent] 正在建立项目索引 (预热就绪中)...`);
            try {
                // 执行一个真实但轻量的任务来索引项目并验证模型
                // 使用 'plan' 模式来确保逻辑路径与实际输入一致
                await this.queue.enqueue(
                    this.appId,
                    'internal-prewarm',
                    'list the project root files briefly', 
                    this.projectRoot,
                    'plan',
                    undefined,
                    undefined,
                    true // silent = true
                );
                Dashboard.logEvent('SYS', `[Agent] 预热完成，索引已建立。`);
            } catch (error: any) {
                Dashboard.logEvent('ERR', `[Agent] 预热失败: ${error.message}`);
                throw error; // 向上抛出以触发 main.ts 中的 status = 'error'
            }

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

    private createOnlineCard() {
        const info = this.getStatusInfo();
        return {
            config: { wide_screen_mode: true },
            header: { title: { content: "🚀 AgentSocial 已上线", tag: "plain_text" }, template: "wathet" },
            elements: [
                {
                    tag: "column_set",
                    flex_mode: "flow",
                    background_style: "default",
                    columns: [
                        {
                            tag: "column",
                            width: "weighted",
                            weight: 1,
                            elements: [
                                { tag: "div", text: { content: `**机器人:**\n${this.botName}`, tag: "lark_md" } }
                            ]
                        },
                        {
                            tag: "column",
                            width: "weighted",
                            weight: 1,
                            elements: [
                                { tag: "div", text: { content: `**项目:**\n${info.projectName}`, tag: "lark_md" } }
                            ]
                        }
                    ]
                },
                { tag: "hr" },
                { tag: "note", elements: [{ tag: "plain_text", content: `上线时间: ${info.time} | 模式: ${info.agentType}` }] }
            ]
        };
    }

    private createOfflineCard() {
        const info = this.getStatusInfo();
        return {
            config: { wide_screen_mode: true },
            header: { title: { content: "📴 AgentSocial 已下线", tag: "plain_text" }, template: "grey" },
            elements: [
                { tag: "div", text: { content: `**机器人:** ${this.botName || this.appId}\n**项目:** ${info.projectName}`, tag: "lark_md" } },
                { tag: "note", elements: [{ tag: "plain_text", content: `下线时间: ${new Date().toLocaleString()}` }] }
            ]
        };
    }

    private createOperatedCard(title: string, content: string, status: string, template: string = 'grey') {
        const safeContent = content.length > 800 ? content.substring(0, 797) + '...' : content;
        return {
            config: { wide_screen_mode: true },
            header: {
                title: { content: title, tag: "plain_text" },
                template: template
            },
            elements: [
                {
                    tag: "div",
                    text: { content: `**操作内容:**\n${safeContent}`, tag: "lark_md" }
                },
                { tag: "hr" },
                {
                    tag: "note",
                    elements: [
                        { tag: "plain_text", content: `状态: ${status}` }
                    ]
                }
            ]
        };
    }

    protected async sendApprovalCard(chatId: string, prompt: string): Promise<void> {
        const card = {
            config: { wide_screen_mode: true },
            header: { title: { content: "⚠️ 敏感操作审批", tag: "plain_text" }, template: "orange" },
            elements: [
                {
                    tag: "div",
                    text: { content: `**Agent 申请执行以下敏感操作:**`, tag: "lark_md" }
                },
                {
                    tag: "div",
                    text: { content: `\`\`\`\n${prompt}\n\`\`\``, tag: "lark_md" }
                },
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
                {
                    tag: "div",
                    text: { content: `🔍 **指令目标:**\n${originalCmd}`, tag: "lark_md" }
                },
                { tag: "hr" },
                {
                    tag: "div",
                    text: { content: `💡 **拟定执行计划:**\n${plan}`, tag: "lark_md" }
                },
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
                },
                {
                    tag: "note",
                    elements: [{ tag: "plain_text", content: "请预览计划，点击按钮后 Agent 将进入自主执行模式" }]
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
                title: { content: isSuccess ? "✅ 任务执行成功" : "❌ 任务执行失败", tag: "plain_text" }, 
                template: isSuccess ? "green" : "red" 
            },
            elements: [
                {
                    tag: "div",
                    text: { content: `🔍 **目标:** ${originalCmd}`, tag: "lark_md" }
                },
                { tag: "hr" },
                { 
                    tag: "div", 
                    text: { 
                        content: `📑 **执行输出:**\n${result.length > 2500 ? result.substring(0, 2400) + "\n\n... (内容过长已截断)" : result}`, 
                        tag: "lark_md" 
                    } 
                },
                { tag: "hr" },
                {
                    tag: "note",
                    elements: [
                        { tag: "plain_text", content: `完成时间: ${new Date().toLocaleString()}` }
                    ]
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
                'plan'
            );

            // Stage 2: Send Card
            await this.sendPlanCard(chatId, content, result.stdout);

        } catch (error: any) {
            await this.sendReply(chatId, `❌ 计划生成失败: ${error.message}`);
        }
    }

    private async executePlan(chatId: string, content: string, messageId?: string) {
        try {
            const result = await this.queue.enqueue(
                this.appId,
                chatId,
                content, // Re-run with same command but in auto mode
                this.projectRoot,
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

            // 1. 发送最终的结果卡片（新消息）
            await this.sendResultCard(chatId, content, output, isSuccess);

            // 2. 更新最初的计划确认卡片，告知已结束
            if (messageId) {
                const finalStatus = isSuccess ? "✅ 已完成，详情见下方结果卡片" : "❌ 执行失败，详情见下方卡片";
                const card = this.createOperatedCard("📋 执行计划 (处理结束)", `**目标:** ${content}`, finalStatus, isSuccess ? "green" : "red");
                await this.api.updateCard(messageId, card).catch(() => {});
            }
        } catch (error: any) {
            await this.sendResultCard(chatId, content, `❌ 执行过程中出现异常: ${error.message}`, false);
            if (messageId) {
                const card = this.createOperatedCard("📋 执行计划 (出现故障)", `**目标:** ${content}`, "❌ 系统异常中断", "red");
                await this.api.updateCard(messageId, card).catch(() => {});
            }
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
