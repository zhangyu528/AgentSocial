import * as lark from '@larksuiteoapi/node-sdk';

/**
 * Feishu API Service Wrapper using Lark SDK (TypeScript version)
 */
export class FeishuAPI {
    private client: any; // Using any because some SDK versions have complex nested types
    private appId: string;

    constructor(appId: string, appSecret: string) {
        this.appId = appId;
        this.client = new lark.Client({
            appId: appId,
            appSecret: appSecret,
            disableTokenCache: true,
            logger: {
                error: () => { },
                warn: () => { },
                info: () => { },
                debug: () => { },
                trace: () => { }
            }
        });
    }

    /**
     * Get Application Info (v6)
     * Corresponds to permission: admin:app.info:readonly
     */
    async getApplicationInfo(): Promise<any> {
        try {
            const res = await this.client.request({
                method: 'GET',
                url: `/open-apis/application/v6/applications/${this.appId}`,
                params: {
                    lang: 'zh_cn'
                }
            });
            return res.data;
        } catch (error: any) {
            const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            throw new Error(`[Feishu API Error] ${detail}`);
        }
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
            const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            throw new Error(`[Feishu API Error] ${detail}`);
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
            const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            throw new Error(`Failed to send card to ${receiveId} (${receiveIdType}): ${detail}`);
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
     * Get App Visibility (v2)
     * Using the path suggested by user: /open-apis/application/v2/app/visibility
     */
    async getAppVisibility(): Promise<any> {
        try {
            const res = await this.client.request({
                method: 'GET',
                url: `/open-apis/application/v2/app/visibility`,
                params: {
                    app_id: this.appId,
                    user_id_type: 'open_id'
                }
            });
            return res.data;
        } catch (error: any) {
            const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            throw new Error(`[Feishu API Error] ${detail}`);
        }
    }

    /**
     * Resolve visibility (departments/users) to a flat list of user IDs
     */
    async getVisibleUsers(): Promise<string[]> {
        try {
            const visibility = await this.getAppVisibility();
            if (visibility.is_all) {
                return ["ALL_MEMBERS"];
            }

            // Fix for V2 structure: data.users and data.departments
            const userIds: string[] = (visibility.users || [])
                .map((u: any) => u.user_id || u.open_id)
                .filter((id: string) => !!id);

            const deptIds: string[] = visibility.departments || [];

            for (const deptId of deptIds) {
                let token = "";
                do {
                    const res = await this.client.contact.user.findByDepartment({
                        params: {
                            department_id: deptId,
                            user_id_type: 'open_id',
                            page_size: 50,
                            page_token: token,
                        }
                    });
                    const items = res.data?.items || [];
                    items.forEach((u: any) => {
                        const id = u.open_id || u.user_id;
                        if (id) userIds.push(id);
                    });
                    token = res.data?.page_token || "";
                } while (token);
            }

            return Array.from(new Set(userIds));
        } catch (error: any) {
            console.error(`[FeishuAPI] Error resolving visible users: ${error.message}`);
            return [];
        }
    }

    /**
     * Probes current permissions and connectivity, matching the setup checklist
     */
    async diagnose(): Promise<{ name: string, status: boolean, error?: string, hint?: string }[]> {
        const report = [];

        // 1. Auth & Bot Identity
        try {
            await this.getBotInfo();
            report.push({ name: '[BOT_CAPABILITY] 机器人能力', status: true });
        } catch (e: any) {
            report.push({
                name: '[BOT_CAPABILITY] 机器人能力',
                status: false,
                error: e.message,
                hint: '请确保在飞书后台“应用功能”->“机器人”中已启用机器人，并发布版本。'
            });
            return report;
        }

        // 2. Scope: Message Read (Try to probe im:message:readonly)
        try {
            await this.getMessages('oc_probe_id', 1);
            report.push({ name: '[SCOPE_READ_MESSAGE] 权限: 获取单聊、群组消息', status: true });
        } catch (e: any) {
            const isDenied = e.message.includes('permission') || e.message.includes('403') || e.message.includes('Forbidden');
            report.push({
                name: '[SCOPE_READ_MESSAGE] 权限: 获取单聊、群组消息',
                status: !isDenied,
                hint: isDenied ? '请在“权限管理”开启并在“版本发布”中生效。' : undefined
            });
        }

        // 3. Scope: Chat List (im:chat:readonly)
        try {
            await this.getJoinedChats(1);
            report.push({ name: '[SCOPE_READ_CHAT] 权限: 获取群组信息', status: true });
        } catch (e: any) {
            report.push({
                name: '[SCOPE_READ_CHAT] 权限: 获取群组信息',
                status: false,
                hint: '请在“权限管理”开启“获取群组信息”并在“版本发布”中生效。'
            });
        }

        // 4. Scope: App Info (Essential for Metadata & Visibility)
        try {
            await this.getApplicationInfo();
            report.push({ name: '[SCOPE_APP_INFO] 权限: 获取应用信息', status: true });
        } catch (e: any) {
            report.push({
                name: '[SCOPE_APP_INFO] 权限: 获取应用信息',
                status: false,
                error: e.message,
                hint: '请在“权限管理”开启“获取应用信息”权限并发布版本，以支持成员控制功能。'
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
