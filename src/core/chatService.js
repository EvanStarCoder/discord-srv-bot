import fs from 'fs';
import path from "path";
import { fileURLToPath } from 'url';
import instruction from '@/media/prompt/instruction.js';
// 修正 __dirname 在 ES Modules 中的問題
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 將設定檔路徑放在最上方，方便管理
//const tempFilePath = path.join(__dirname, '../commands/chat/temp.json'); // 注意路徑向上移一層
//const instruction = fs.readFileSync(path.join(__dirname, '../commands/chat/instruction.js'), 'utf-8'); // 直接讀取檔案內容
const API_URL = 'http://4090p8000.huannago.com/v1/chat/completions';//'http://127.0.0.1:8080/v1/chat/completions';//'http://4090p8000.huannago.com/v1/chat/completions'; //

/**
 * 取得 LLM 的回覆
 * @param {string} userMessage 使用者傳送的原始訊息
 * @param {string} userName 使用者的暱稱
 * @returns {Promise<string|null>} AI 的回覆文字，或在失敗時回傳 null
 */
export const getLlmReply = async (userMessage, userName) => {
    // --- 讀取並準備對話歷史 ---
    /*let chatHistory = [];
    try {
        if (fs.existsSync(tempFilePath)) {
            const tempChatData = fs.readFileSync(tempFilePath, 'utf8');
            chatHistory = tempChatData ? JSON.parse(tempChatData) : [];
        }
    } catch (e) {
        console.error("讀取或解析 temp.json 失敗:", e);
        chatHistory = []; // 發生錯誤時重置歷史
    }*/

    // --- 建構 messages 陣列 ---
    const messages = [
        { role: 'system', content: instruction }, //
    ];
    // 這裡可以加上載入歷史對話的邏輯 (目前您的程式碼是註解掉的)
    // 2. 載入歷史對話
    /*chatHistory.forEach(turn => {
        messages.push({ role: 'user', content: turn.user });
        messages.push({ role: 'assistant', content: turn.assistant });
    });*/

    const userMessageContent = `**${userName}**： 「${userMessage}」`;
    messages.push({ role: 'user', content: userMessageContent }); //

    // --- 發送 API 請求 ---
    try {

        //console.log(messages);
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: messages,
                temperature: 0.9,
                top_k: 20,
                top_p: 0.95,
                max_tokens: 4096,
                // ...其他參數
            })
        });

        if (response.ok) {
            const data = await response.json();
            const assistantReply = data.choices[0]?.message?.content.trim(); //

            if (assistantReply) {
                // 更新對話歷史
                //chatHistory.push({ user: userMessageContent, assistant: assistantReply }); //
                //fs.writeFileSync(tempFilePath, JSON.stringify(chatHistory, null, 2)); //
                return assistantReply; // *** 重要：回傳結果，而不是直接回覆 ***
            }
        } else {
            const errorText = await response.text();
            console.error("API 錯誤:", errorText);
        }
        return null; // 發生錯誤時回傳 null
    } catch (error) {
        console.error("執行 fetch 時發生錯誤:", error);
        return null;
    }
};

/**
 * 清除對話歷史
 */
export const clearChatHistory = () => {
    try {
        fs.writeFileSync(tempFilePath, '[]'); //
        console.log("對話歷史已清除。");
        return true;
    } catch (error) {
        console.error("清除歷史紀錄失敗:", error);
        return false;
    }
};