const HttpClient = require('../../../utils/http');
const { env } = require('../../../config/env');
const http = new HttpClient();

const TG_MAX_LEN = 4096;

class TelegramBotService {
    constructor() {
        this.token = env.telegram.botToken;
        this.chatId = env.telegram.chatId;
        this.apiUrl = `https://api.telegram.org/bot${this.token}`;
    }

    /**
     * Escape text for Telegram MarkdownV2 format.
     * Characters that must be escaped: _ * [ ] ( ) ~ ` > # + - = | { } . !
     */
    _escapeMarkdownV2(text) {
        // Don't escape inside code blocks - handle them separately
        return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
    }

    /**
     * Split long text into chunks <= 4096 chars, preferring section breaks.
     */
    _chunkText(text) {
        if (text.length <= TG_MAX_LEN) return [text];

        const chunks = [];
        let remaining = text;

        while (remaining.length > 0) {
            if (remaining.length <= TG_MAX_LEN) {
                chunks.push(remaining);
                break;
            }

            let splitAt = -1;
            const searchWindow = remaining.substring(0, TG_MAX_LEN);

            for (const sep of ['\n---\n', '\n## ']) {
                const lastIdx = searchWindow.lastIndexOf(sep);
                if (lastIdx > TG_MAX_LEN * 0.3) {
                    splitAt = lastIdx;
                    break;
                }
            }

            if (splitAt === -1) {
                splitAt = searchWindow.lastIndexOf('\n');
            }

            if (splitAt === -1) {
                splitAt = TG_MAX_LEN;
            }

            chunks.push(remaining.substring(0, splitAt));
            remaining = remaining.substring(splitAt);
        }

        return chunks.filter(c => c.trim().length > 0);
    }

    /**
     * Send text message to Telegram chat (auto-chunk if >4096 chars)
     * Uses plain text mode to avoid Markdown parsing errors.
     */
    async sendMessage(text) {
        if (!this.token || !this.chatId) {
            console.warn('Telegram configuration missing. Skipping notification.');
            return false;
        }

        const chunks = this._chunkText(text);
        console.log(`Telegram: splitting into ${chunks.length} message(s)`);

        let allSuccess = true;
        for (let i = 0; i < chunks.length; i++) {
            try {
                await http.post(`${this.apiUrl}/sendMessage`, {
                    chat_id: this.chatId,
                    text: chunks[i]
                    // No parse_mode — send as plain text to avoid formatting errors
                });
                console.log(`Telegram chunk ${i + 1}/${chunks.length} sent.`);
            } catch (error) {
                console.error(`Telegram chunk ${i + 1}/${chunks.length} failed:`, error.message);
                allSuccess = false;
            }

            if (i < chunks.length - 1) {
                await new Promise(r => setTimeout(r, 500));
            }
        }

        return allSuccess;
    }
}

module.exports = new TelegramBotService();
