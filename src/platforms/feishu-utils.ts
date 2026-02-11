export interface FeishuMention {
    id: string | { open_id: string };
    key: string;
}

/**
 * Strips bot mentions from message content and returns trimmed command
 */
export function parseFeishuCommand(content: string, mentions: FeishuMention[], botId: string | null): string {
    let cleanContent = content;

    mentions.forEach((m) => {
        const mId = (typeof m.id === 'object') ? m.id.open_id : m.id;
        if (mId === botId) {
            cleanContent = cleanContent.replace(m.key, '');
        }
    });

    return cleanContent.trim();
}
