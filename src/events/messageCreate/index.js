import { getLlmReply } from '@/core/chatService.js';
import { useAppStore } from '@/store/app';


//import { OpenCC } from 'opencc';

// 【修改】使用 createConverter 建立一個同步的轉換函式
//const converter = new OpenCC('s2t.json');

export const event = {
    name: 'messageCreate',
    once: false,
};

function escapeBackticks(text) {
    if (!text) return '';
    // 1. 使用一個不可能出現的字串作為程式碼區塊的臨時佔位符
    const placeholder = '___CODE_BLOCK_DELIMITER___';
    // 2. 保護程式碼區塊
    let processedText = text.replaceAll('```', placeholder);
    // 3. 將所有剩餘的單反引號加上跳脫字元
    processedText = processedText.replaceAll('`', '\\`');
    // 4. 將程式碼區塊還原
    processedText = processedText.replaceAll(placeholder, '```');
    return processedText;
}

export const action = async (message) => {
    // 忽略來自機器人的訊息
    //if (message.author.bot) return;
    // 如果訊息的發送者 ID，和我們機器人自己的 ID 相同，就忽略
    if (message.author.id === message.client.user.id) return;

    const appStore = useAppStore();
    const channelId = message.channel.id;

    // =======================================================
    // 【新功能】X/Twitter/Instagram 連結自動轉換 (升級版)
    // =======================================================
    const linkRegex = /https?:\/\/(?:www\.)?(twitter|x|instagram|facebook)\.com\/\S+/g;
    const matches = message.content.match(linkRegex);

    if (matches && matches.length > 0) {
        // 檢查機器人是否有管理訊息的權限，沒有就直接返回，避免出錯
        if (!message.guild.members.me?.permissions.has('ManageMessages')) {
            console.log(`[權限不足] 無法在頻道 ${message.channel.name} 抑制預覽，因為缺少「管理訊息」權限。`);
            return;
        }

        // 延遲一小段時間，確保 Discord 已經處理了原始訊息
        await new Promise(resolve => setTimeout(resolve, 500)); // 延遲 1 秒

        const fixedLinks = matches.map(url => {
            if (url.includes('twitter.com')) {
                return url.replace('twitter.com', 'fxtwitter.com');
            } else if (url.includes('x.com')) {
                return url.replace('x.com', 'fixupx.com');
            } else if (url.includes('instagram.com')) {
                return url.replace('instagram.com', 'ddinstagram.com');
            } else if (url.includes('www.instagram.com')) {
                return url.replace('www.instagram.com', 'ddinstagram.com');
            } else if (url.includes('www.facebook.com')) {
                return url.replace('www.facebook.com', process.env.DC_FIX_API);
            }  else if (url.includes('facebook.com')) {
                return url.replace('facebook.com', process.env.DC_FIX_API);
            }
            return url;
        });

        // 【修改】只包含修復後的連結，不加任何額外文字
        const replyContent = fixedLinks.join('\n');

        try {
            // 【修改】1. 抑制原始訊息的預覽
            await message.suppressEmbeds(true);

            // 【修改】2. 發送只包含連結的新訊息
            await message.channel.send({
                content: replyContent,
            });
        } catch (error) {
            console.error("抑制預覽或發送新連結時發生錯誤:", error);
        }
    }

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
        let llmHistory;
        const isCurrentlyMonitoring = appStore.monitoringChannels.has(channelId);

        if (isCurrentlyMonitoring && appStore.chatHistories.has(channelId)) {
            const history = appStore.chatHistories.get(channelId);
            const contextHistory = history.slice(0, -1);
            // 【新增】先取得機器人自己的名字，方便後面比較
            const botName = message.client.user.username;
            const formattedHistory = contextHistory.length > 0
                ? contextHistory.map(msg => {
                    const timeString = new Date(msg.timestamp).toLocaleTimeString('zh-TW');
                    let line = `[${timeString}]`;
                    console.log(`處理訊息: ${line}`); // 用於除錯
                    // 【修改】根據發言者是否為機器人，決定使用的格式
                    if (msg.author === botName) {
                        // 如果是機器人自己，使用新格式
                        return `${line} [${msg.author}](妳自己)說: ${msg.content}`;
                    } else {
                        // 如果是其他人，維持舊格式
                        return `${line} [${msg.author}]說: ${msg.content}`;
                    }
                }).join('\n')
                : `（尚無對話紀錄）`;

            //const currentUserInput = `# 當前對話紀錄\n**[${nickname}]**對妳說: ${cleanMessage || '...'}`;
            //llmMessage = `對話紀錄:\n${formattedHistory}\n\n${currentUserInput}`;
            llmHistory = `${formattedHistory}`;
            
            //llmMessage = `**${nickname}**對妳說:` + cleanMessage || `(**${nickname}**標記妳。)`;
            //llmMessage = `**${nickname}**對妳說: ${cleanMessage}` || `(**${nickname}**標記妳。)`;
            /*console.log("--- Sending context to LLM ---"); // 可選的偵錯訊息
            console.log(llmMessage);
            console.log("-----------------------------");*/
            
        } else {
            llmHistory = `（尚無對話紀錄）`;
            //llmMessage = cleanMessage || `(**${nickname}**標記妳。)`;
        }

        if (!cleanMessage) {
            llmMessage = `([${nickname}]標記妳。)`;
        } else {
            llmMessage = `[${nickname}]對妳說: ${cleanMessage}`;
        }



        const assistantReply = await getLlmReply(llmHistory, llmMessage, message);

        if (assistantReply) {
            // 這裡我們假設 assistantReply 裡面可能包含 <think> 標籤
            // 先過濾掉要給使用者看的內容
            const thinkTagRegexForReply = /<think>[\s\S]*?<\/think>/g;
            const finalReplyToShow = assistantReply.replace(thinkTagRegexForReply, '').trim();

            // 【新增】使用 OpenCC 轉換簡體中文到繁體中文
            //const convertedReply = convert(assistantReply);

/*        // 送出回覆，並設定為不提及原發文者，避免干擾
        await message.reply({
            content: replyContent,
            allowedMentions: {
                repliedUser: false
            }
        });*/
            //const finalReplyToShow = escapeBackticks(cleanedReply);
            //console.log("LLM 回覆內容:", finalReplyToShow);
            const botReplyMessage = await message.reply({
                content: escapeBackticks(finalReplyToShow)/*, 
                allowedMentions: {
                    repliedUser: false
                }*/
            });
            //console.log(finalReplyToShow);
            //const thinkReplyMessage = await message.reply(assistantReply);
            //const botReplyMessage = await message.reply(assistantReply);

            if (isCurrentlyMonitoring) {
                const history = appStore.chatHistories.get(channelId);
                if (history) {
                    // 【新增】在存入歷史紀錄前，再次確認並過濾內容
                    //const thinkTagRegexForLog = /<think>[\s\S]*?<\/think>/g;
                    //const filteredBotContent = botReplyMessage.content.replace(thinkTagRegexForLog, '').trim();

                    history.push({
                        id: botReplyMessage.id,
                        author: botReplyMessage.author.username,
                        content: finalReplyToShow,
                        timestamp: botReplyMessage.createdTimestamp,
                    });
                    if (history.length > 10) {
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