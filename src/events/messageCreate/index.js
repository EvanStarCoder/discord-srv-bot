//import { EmbedBuilder } from 'discord.js'; // 保留以防未來使用，但目前非必需
import { fixSocialLinks } from '@/core/utils.js';
import { getLlmReply } from '@/core/chatService.js';
import { useAppStore } from '@/store/app.js';

function escapeBackticks(text) {
    if (!text) return '';
    const placeholder = '___CODE_BLOCK_DELIMITER___';
    let processedText = text.replaceAll('```', placeholder);
    processedText = processedText.replaceAll('`', '\\`');
    processedText = processedText.replaceAll(placeholder, '```');
    return processedText;
}

export const event = {
    name: 'messageCreate',
    once: false,
};

export const action = async (message) => {
    // 1. 忽略自己發出的訊息，避免無限循環
    if (message.author.id === message.client.user.id) return;

    const appStore = useAppStore();
    const channelId = message.channel.id;

    // 2. 如果頻道正在被監控，優先記錄歷史
    if (appStore.monitoringChannels.has(channelId)) {
        const history = appStore.chatHistories.get(channelId) || [];
        const authorDisplayName = message.member?.nickname || message.author.username;
        
        let renderedContent = message.content;
        message.mentions.members.forEach(member => {
            const mentionDisplayName = member.nickname || member.user.username;
            renderedContent = renderedContent.replace(new RegExp(`<@!?${member.id}>`, 'g'), `@${mentionDisplayName}`);
        });
        message.mentions.roles.forEach(role => {
            renderedContent = renderedContent.replace(new RegExp(`<@&${role.id}>`, 'g'), `@${role.name}`);
        });

        // 【修改一】在儲存時，加上 isMention 標記
        history.push({
            id: message.id,
            author: authorDisplayName,
            content: renderedContent,
            timestamp: message.createdTimestamp,
            isMention: message.mentions.has(message.client.user) // 記住這是不是 @bot 的訊息
        });

        if (history.length > 20) history.shift();
        appStore.chatHistories.set(channelId, history);
    }

    // 3. 檢查並處理社群連結 (優先級最高)
    const fixedContent = fixSocialLinks(message.content);
    if (fixedContent !== message.content) {
        if (message.guild.members.me?.permissions.has('ManageMessages')) {
            try {
                // 【最終修正】先發送，後抑制
                await message.channel.send({ content: fixedContent });
                await message.suppressEmbeds(true);
            } catch (error) {
                console.error("處理社群連結時發生錯誤:", error);
            }
        }
        // 處理完連結後，結束函式，不再檢查 @提及
        return; 
    }

    // 4. 如果沒有連結，才檢查並處理 @提及
    if (message.mentions.has(message.client.user)) {
        await message.channel.sendTyping();
        const nickname = message.member?.nickname || message.author.username;
        const cleanMessage = message.content.replace(/<@!?&?\d+>/g, '').trim();

        let llmMessage;
        let llmHistory = '（尚無對話紀錄）';
        const isCurrentlyMonitoring = appStore.monitoringChannels.has(channelId);

        if (isCurrentlyMonitoring) {
            const history = appStore.chatHistories.get(channelId);
            const contextHistory = history?.slice(0, -1) || []; // 安全地處理 history 不存在的情況
            const botName = message.client.user.username;
            
            if (contextHistory.length > 0) {
                llmHistory = contextHistory.map(msg => {
                    const timeString = new Date(msg.timestamp).toLocaleTimeString('zh-TW');
                    let authorTag = `[${msg.author}]`;
                    if (msg.author === botName) {
                        const botDisplayName = message.guild?.members.me?.displayName ?? botName;
                        authorTag = `[${botDisplayName}](你自己)`;
                    } else {
                        // 【修改二】根據 isMention 標記來決定使用者標籤的格式
                        if (msg.isMention) {
                            authorTag = `[${msg.author}](對你說)`;
                        } else {
                            authorTag = `[${msg.author}]`;
                        }
                    }
                    return `[${timeString}] ${authorTag}說： ${msg.content}`;
                }).join('\n');
            }
        }
        
        if (!cleanMessage) {
            llmMessage = `([${nickname}]標記你。)`;
        } else {
            llmMessage = `[${nickname}]對你說： ${cleanMessage}`;
        }
        
        const assistantReply = await getLlmReply(llmHistory, llmMessage, message);

        if (assistantReply) {
            const cleanedReply = assistantReply.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            const finalReplyToShow = escapeBackticks(cleanedReply);
            
            const botReplyMessage = await message.reply({
                content: finalReplyToShow,
                allowedMentions: { repliedUser: false }
            });

            if (isCurrentlyMonitoring) {
                const history = appStore.chatHistories.get(channelId);
                if (history) {
                    history.push({
                        id: botReplyMessage.id,
                        author: botReplyMessage.author.username,
                        content: botReplyMessage.content,
                        timestamp: botReplyMessage.createdTimestamp,
                    });
                    if (history.length > 20) { history.shift(); }
                    appStore.chatHistories.set(channelId, history);
                }
            }
        } else {
            await message.reply("💥 糟糕，我好像斷線了，請稍後再試。");
        }
    }
};
