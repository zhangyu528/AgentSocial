import { IAgentExecutor, ExecutionResult } from '../core/executor';
import { TaskQueue } from '../core/queue';
import * as path from 'path';

export abstract class BaseBot {
    protected config: any;
    protected appId: string;
    protected projectRoot: string;
    protected executor: IAgentExecutor;
    protected queue: TaskQueue;

    constructor(config: any, executor: IAgentExecutor, defaultProjectRoot: string) {
        this.config = config;
        this.appId = config.app_id;
        this.projectRoot = config.project_path || defaultProjectRoot;
        this.executor = executor;
        this.queue = new TaskQueue(this.executor);
    }

    abstract start(): Promise<void>;
    abstract stop(): Promise<void>;

    /**
     * 清理所有资源
     */
    async destroy() {
        await this.stop();
        this.executor.dispose();
    }

    /**
     * Helper to get standard status info
     */
    protected getStatusInfo() {
        return {
            projectName: path.basename(this.projectRoot),
            agentType: this.config.agent_type || 'gemini',
            time: new Date().toLocaleString()
        };
    }

    /**
     * Platform-specific implementation for sending a reply to a command
     */
    protected abstract sendReply(chatId: string, message: string): Promise<void>;

    /**
     * Platform-specific implementation for proactive notification (interrupted messages)
     */
    protected abstract sendProactive(chatId: string, message: string): Promise<void>;

    /**
     * Central Command Processor
     * Handles queuing, execution, and real-time interception of [NOTIFY] tags.
     */
    protected async handleIncomingCommand(chatId: string, content: string) {
        // 过滤内部预热指令，不发送任何消息回平台
        if (chatId === 'internal-prewarm') return;

        const agentName = this.config.agent_type || 'Agent';
        
        await this.sendReply(chatId, `⏳ [${agentName}] 正在处理: "${content}"...`);

        try {
            const result: ExecutionResult = await this.queue.enqueue(
                this.appId,
                chatId,
                content,
                this.projectRoot,
                this.config.sandbox,
                (data) => this.interceptProactiveMessages(chatId, data)
            );

            let finalMsg = result.code === 0 ? result.stdout.trim() : `❌ 运行出错:\n${result.stderr || "执行失败"}`;
            if (!finalMsg) finalMsg = "✅ 执行完毕。";
            
            // Handle long messages
            if (finalMsg.length > 4000) {
                finalMsg = finalMsg.substring(0, 3900) + "\n\n... (输出过长已截断)";
            }

            await this.sendReply(chatId, finalMsg);
        } catch (error: any) {
            await this.sendReply(chatId, `❌ 系统错误: ${error.message}`);
        }
    }

    /**
     * Scans stdout for the [NOTIFY] marker and triggers a proactive message
     */
    private interceptProactiveMessages(chatId: string, data: string) {
        if (!data.includes('[NOTIFY]')) return;

        const lines = data.split('\n');
        for (const line of lines) {
            if (line.includes('[NOTIFY]')) {
                const msg = line.split('[NOTIFY]')[1].trim();
                if (msg) {
                    this.sendProactive(chatId, msg).catch(e => 
                        console.error(`[${this.appId}] Proactive send failed:`, e.message)
                    );
                }
            }
        }
    }
}
