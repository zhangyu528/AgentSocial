import { IAgentExecutor, ExecutionResult } from '../core/executor';
import { TaskQueue } from '../core/queue';
import { Dashboard } from '../ui/dashboard';
import * as path from 'path';

export abstract class BaseBot {
    protected config: any;
    protected appId: string;
    protected projectRoot: string;
    protected executor: IAgentExecutor;
    protected queue: TaskQueue;
    protected processedMessageIds: Set<string> = new Set();

    constructor(config: any, executor: IAgentExecutor, defaultProjectRoot: string) {
        this.config = config;
        this.appId = config.app_id;
        this.projectRoot = config.project_path || defaultProjectRoot;
        this.executor = executor;
        this.queue = new TaskQueue(this.executor);
    }

    abstract start(): Promise<void>;
    abstract stop(): Promise<void>;

    async destroy() {
        await this.stop();
        this.executor.dispose();
    }

    protected getStatusInfo() {
        return {
            projectName: path.basename(this.projectRoot),
            agentType: this.config.agent_type || 'gemini',
            time: new Date().toLocaleString()
        };
    }

    protected abstract sendReply(chatId: string, message: string): Promise<void>;
    protected abstract sendProactive(chatId: string, message: string): Promise<void>;
    protected abstract sendApprovalCard(chatId: string, prompt: string): Promise<void>;

    public approve(chatId: string) {
        this.executor.respond(this.appId, chatId, 'y');
    }

    public deny(chatId: string) {
        this.executor.respond(this.appId, chatId, 'n');
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
        await this.sendReply(chatId, `⏳ [${agentName}] 正在处理: "${content}"...`);

        try {
            const result: ExecutionResult = await this.queue.enqueue(
                this.appId,
                chatId,
                content,
                this.projectRoot,
                this.config.sandbox,
                'auto',
                (data) => this.interceptProactiveMessages(chatId, data),
                (prompt) => this.sendApprovalCard(chatId, prompt)
            );

            // 过滤 ANSI 转义字符，让发回飞书的文字变干净
            const cleanOutput = result.stdout.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{4,4}g|(?:\d{1,4}(?:;\d{0,4})*)?[0-9,A-PR-Zcf-nqry=><])/g, '').trim();

            let finalMsg = result.code === 0 ? cleanOutput : `❌ 运行出错:\n${cleanOutput || "执行失败"}`;
            if (!finalMsg) finalMsg = "✅ 执行完毕。";
            if (finalMsg.length > 4000) finalMsg = finalMsg.substring(0, 3900) + "\n\n... (输出过长已截断)";

            await this.sendReply(chatId, finalMsg);
        } catch (error: any) {
            await this.sendReply(chatId, `❌ 系统错误: ${error.message}`);
        }
    }

    protected interceptProactiveMessages(chatId: string, data: string) {
        if (!data.includes('[NOTIFY]')) return;
        const lines = data.split('\n');
        for (const line of lines) {
            if (line.includes('[NOTIFY]')) {
                const msg = line.split('[NOTIFY]')[1].trim();
                if (msg) this.sendProactive(chatId, msg).catch(() => { });
            }
        }
    }
}