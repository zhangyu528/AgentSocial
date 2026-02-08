import * as lark from '@larksuiteoapi/node-sdk';

/**
 * Feishu API Service Wrapper using Lark SDK (TypeScript version)
 */
export class FeishuAPI {
    private client: any; // Using any because some SDK versions have complex nested types

    constructor(appId: string, appSecret: string) {
        this.client = new lark.Client({
            appId: appId,
            appSecret: appSecret,
            disableTokenCache: false,
            logger: {
                error: () => {},
                warn: () => {},
                info: () => {},
                debug: () => {},
                trace: () => {}
            }
        });
    }

    /**
     * Get Bot info (to get bot's open_id)
     */
    async getBotInfo(): Promise<any> {
        try {
            const res = await this.client.request({
                method: 'GET',
                url: '/open-apis/bot/v3/info',
            });
            return res.bot;
        } catch (error: any) {
            throw new Error(`Failed to get bot info: ${error.message}`);
        }
    }

    /**
     * Send a text message
     */
    async sendMessage(receiveId: string, receiveIdType: string, text: string): Promise<any> {
        try {
            return await this.client.im.message.create({
                params: {
                    receive_id_type: receiveIdType,
                },
                data: {
                    receive_id: receiveId,
                    msg_type: 'text',
                    content: JSON.stringify({ text: text }),
                },
            });
        } catch (error: any) {
            throw new Error(`Failed to send message: ${error.message}`);
        }
    }

    /**
     * Send an interactive card message
     */
    async sendCard(receiveId: string, receiveIdType: string, cardContent: any): Promise<any> {
        try {
            return await this.client.im.message.create({
                params: {
                    receive_id_type: receiveIdType,
                },
                data: {
                    receive_id: receiveId,
                    msg_type: 'interactive',
                    content: JSON.stringify(cardContent),
                },
            });
        } catch (error: any) {
            throw new Error(`Failed to send card: ${error.message}`);
        }
    }

    /**
     * Update an interactive card message
     */
    async updateCard(messageId: string, cardContent: any): Promise<any> {
        try {
            return await this.client.request({
                method: 'PATCH',
                url: `/open-apis/im/v1/messages/${messageId}`,
                data: {
                    content: JSON.stringify(cardContent)
                }
            });
        } catch (error: any) {
            const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            throw new Error(`Feishu Card Update Error: ${detail}`);
        }
    }

    /**
     * Probes current permissions and connectivity, matching the setup checklist
     */
    async diagnose(): Promise<{ name: string, status: boolean, error?: string, hint?: string }[]> {
        const report = [];
        
        // 1. Auth & Bot Identity
        try {
            const info = await this.getBotInfo();
            report.push({ name: `机器人能力 (${info.app_name})`, status: true });
        } catch (e: any) {
            const isBotDisabled = e.message.includes('bot') || e.message.includes('99991663');
            report.push({ 
                name: '机器人能力 (Bot Capability)', 
                status: false, 
                error: e.message,
                hint: isBotDisabled 
                    ? '请确保在飞书后台“应用功能”->“机器人”中已启用机器人。' 
                    : '请检查 App ID 和 App Secret 是否填写正确，并确保已发布应用版本。'
            });
            return report; // Cannot proceed without valid credentials
        }

        // 2. Scope: Message Read (Try to probe im:message:readonly)
        try {
            // Note: Using a non-existent chat_id often returns 404 if permission exists, 
            // but 403/Forbidden if permission is missing.
            await this.getMessages('oc_probe_id', 1);
            report.push({ name: '权限: 接收消息内容 (im:message:readonly)', status: true });
        } catch (e: any) {
            const isDenied = e.message.includes('permission') || e.message.includes('403') || e.message.includes('Forbidden');
            report.push({ 
                name: '权限: 接收消息内容 (im:message:readonly)', 
                status: !isDenied, 
                hint: isDenied ? '请在“权限管理”开启并在“版本发布”中生效。' : undefined
            });
        }

        // 3. Scope: Chat List (im:chat:readonly)
        try {
            await this.getJoinedChats(1);
            report.push({ name: '权限: 获取群组信息 (im:chat:readonly)', status: true });
        } catch (e: any) {
            report.push({ 
                name: '权限: 获取群组信息 (im:chat:readonly)', 
                status: false, 
                hint: '请在“权限管理”开启“获取群组信息”并在“版本发布”中生效。'
            });
        }

        // 4. Scope: Contact List (contact:contact.base:readonly)
        try {
            await this.getUsers(1);
            report.push({ name: '权限: 获取通讯录信息 (contact:contact.base:readonly)', status: true });
        } catch (e: any) {
            report.push({ 
                name: '权限: 获取通讯录信息 (contact:contact.base:readonly)', 
                status: false, 
                hint: '请在“权限管理”开启“获取通讯录基本信息”并在“版本发布”中生效。'
            });
        }

        return report;
    }

    /**
     * Get all users authorized to use this app via flat user list API
     */
    async getUsers(pageSize: number = 50, pageToken: string = ""): Promise<any> {
        try {
            return await this.client.contact.user.list({
                params: {
                    parent_department_id: '0',
                    page_size: pageSize,
                    page_token: pageToken,
                },
            });
        } catch (error: any) {
            const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            throw new Error(`Failed to fetch user list: ${detail}`);
        }
    }

    /**
     * Fetch messages from a chat
     */
    async getMessages(chatId: string, pageSize: number = 50, pageToken: string = ""): Promise<any> {
        try {
            return await this.client.im.message.list({
                params: {
                    container_id_type: 'chat',
                    container_id: chatId,
                    page_size: pageSize,
                    page_token: pageToken
                },
            });
        } catch (error: any) {
            throw new Error(`Failed to fetch messages: ${error.message}`);
        }
    }

    /**
     * Get all chats the bot has joined
     */
    async getJoinedChats(pageSize: number = 100, pageToken: string = ""): Promise<any> {
        try {
            return await this.client.im.chat.list({
                params: {
                    page_size: pageSize,
                    page_token: pageToken
                },
            });
        } catch (error: any) {
            throw new Error(`Failed to get joined chats: ${error.message}`);
        }
    }
}
