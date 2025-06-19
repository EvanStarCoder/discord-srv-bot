import { getLlmReply } from '../../core/chatService.js';
import { useAppStore } from '@/store/app';

export const event = {
    name: 'messageCreate',
    once: false,
};

export const action = async (message) => {
    // 忽略來自機器人的訊息
    if (message.author.bot) return;

    const appStore = useAppStore();
    const channelId = message.channel.id;

    // =======================================================
    // 區塊 1: 優先記錄所有來自"被監控頻道"的使用者訊息
    // =======================================================
    if (appStore.monitoringChannels.has(channelId)) {
        const history = appStore.chatHistories.get(channelId);
        if (history) {
            const authorDisplayName = message.member.nickname || message.author.username;
            
            let renderedContent = message.content;

            // 【最終修正】遍歷提及的 "members" 而非 "users"，以取得伺服器暱稱
            message.mentions.members.forEach(member => {
                const mentionDisplayName = member.nickname || member.user.username;
                const userTagRegex = new RegExp(`<@!?${member.id}>`, 'g');
                renderedContent = renderedContent.replace(userTagRegex, `@${mentionDisplayName}`);
            });

            // 轉換所有被提及的【身分組】(此部分邏輯不變)
            message.mentions.roles.forEach(role => {
                const roleTagRegex = new RegExp(`<@&${role.id}>`, 'g');
                renderedContent = renderedContent.replace(roleTagRegex, `@${role.name}`);
            });

            history.push({
                id: message.id,
                author: authorDisplayName,
                content: renderedContent, // 儲存完全渲染過的、已讀的內容
                timestamp: message.createdTimestamp,
            });

            if (history.length > 20) { 
                history.shift();
            }
            appStore.chatHistories.set(channelId, history);
        }
    }

    // =======================================================
    // 區塊 2: 處理 @ 提及 (此區塊邏輯不變)
    // =======================================================
    if (message.mentions.has(message.client.user)) {
        await message.channel.sendTyping();
        const nickname = message.member.nickname || message.author.username;
        const cleanMessage = message.content.replace(/<@!?&?\d+>/g, '').trim();

        let llmMessage;
        const isCurrentlyMonitoring = appStore.monitoringChannels.has(channelId);

        if (isCurrentlyMonitoring && appStore.chatHistories.has(channelId)) {
            const history = appStore.chatHistories.get(channelId);
            const contextHistory = history.slice(0, -1);

            const formattedHistory = contextHistory.length > 0
                ? contextHistory.map(msg => `[${msg.author}]: ${msg.content}`).join('\n')
                : '（尚無對話紀錄）';

            const currentUserInput = `[${nickname}]對你說: ${cleanMessage || '...'}`;
            llmMessage = `對話紀錄:\n${formattedHistory}\n\n${currentUserInput}`;
            console.log("--- Sending context to LLM ---"); // 可選的偵錯訊息
            console.log(llmMessage);
            console.log("-----------------------------");
            
        } else {
            llmMessage = cleanMessage || "哈囉！";
        }
        
        const assistantReply = await getLlmReply(llmMessage, nickname);

        if (assistantReply) {
            const botReplyMessage = await message.reply(assistantReply);

            if (isCurrentlyMonitoring) {
                const history = appStore.chatHistories.get(channelId);
                if (history) {
                    history.push({
                        id: botReplyMessage.id,
                        author: botReplyMessage.author.username,
                        content: botReplyMessage.content,
                        timestamp: botReplyMessage.createdTimestamp,
                    });
                    if (history.length > 20) {
                        history.shift();
                    }
                    appStore.chatHistories.set(channelId, history);
                }
            }
        } else {
            await message.reply("💥 糟糕，我好像斷線了，請稍後再試。");
        }
    }
};