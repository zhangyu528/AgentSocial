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
    async getJoinedChats(pageSize: number = 100): Promise<any> {
        try {
            return await this.client.im.chat.list({
                params: {
                    page_size: pageSize,
                },
            });
        } catch (error: any) {
            throw new Error(`Failed to get joined chats: ${error.message}`);
        }
    }
}
