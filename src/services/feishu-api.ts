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
     * Probes current permissions and connectivity
     */
    async diagnose(): Promise<{ name: string, status: boolean, error?: string, hint?: string }[]> {
        const report = [];
        
        // 1. Auth & Bot Identity
        try {
            const info = await this.getBotInfo();
            report.push({ name: `Credentials (${info.app_name})`, status: true });
        } catch (e: any) {
            report.push({ 
                name: 'Credentials', 
                status: false, 
                error: e.message,
                hint: 'Check if App ID and App Secret are correct.'
            });
            return report;
        }

        // 2. Scope: Chat List
        try {
            await this.getJoinedChats(1);
            report.push({ name: 'Scope: im:chat:readonly', status: true });
        } catch (e: any) {
            report.push({ 
                name: 'Scope: im:chat:readonly', 
                status: false, 
                error: 'Denied',
                hint: 'Go to "Permission Management" and enable "View group information".'
            });
        }

        // 3. Scope: Sending Messages (Simple check via error codes if possible)
        try {
            // Try to list messages (requires im:message:readonly)
            await this.getMessages('dummy_id', 1);
            report.push({ name: 'Scope: im:message:readonly', status: true });
        } catch (e: any) {
            if (e.message.includes('permission')) {
                report.push({ 
                    name: 'Scope: im:message:readonly', 
                    status: false, 
                    hint: 'Go to "Permission Management" and enable "Receive message content".'
                });
            } else {
                // If it's just "chat not found", the permission is likely there
                report.push({ name: 'Scope: im:message:readonly', status: true });
            }
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
