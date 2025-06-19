import { SlashCommandBuilder } from "discord.js";
// *** 引入我們的服務 ***
import { getLlmReply, clearChatHistory } from '@/core/chatService.js';

export const command = new SlashCommandBuilder()
    .setName("chat")
    .setDescription("與 AI 進行對話")
    .addStringOption(option =>
        option.setName("message")
            .setDescription("要傳送的訊息")
            .setRequired(true))
    .addBooleanOption(option =>
        option.setName("clear")
            .setDescription("清除目前的對話歷史")
            .setRequired(false));

export const execute = async (interaction) => {
    // --- 處理 'clear' 選項 ---
    if (interaction.options.getBoolean("clear")) {
        if (clearChatHistory()) {
            await interaction.reply({ content: "✅ 已清除本次的對話歷史。", ephemeral: true });
        } else {
            await interaction.reply({ content: "❌ 清除歷史時發生錯誤。", ephemeral: true });
        }
        return;
    }

    // --- 處理對話 ---
    const message = interaction.options.getString("message");
    // 從 interaction 取得使用者資訊
    const nickname = interaction.member.nickname || interaction.user.username;

    await interaction.deferReply(); // 等待 AI 回應

    // *** 呼叫服務來取得回覆 ***
    const assistantReply = await getLlmReply(message, nickname);

    if (assistantReply) {
        // *** 將服務回傳的結果，透過 interaction 送出 ***
        await interaction.editReply(`**${nickname}**: ${message}\n\n**紫咲シオン:** ${assistantReply}`);
    } else {
        await interaction.editReply("💥 拉K哥的LLM還沒上線喔! (API 請求失敗或回應為空)");
    }
};