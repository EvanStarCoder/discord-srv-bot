import { SlashCommandBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
// 引入我們之前建立的共用工具
import { fixSocialLinks } from '@/core/utils.js';

// 您的路徑定義
const mediaListPath = path.join(process.cwd(), 'src', 'media', 'italian_brainrot', 'italian_brainrot_data.json');
// 我們不再需要圖片路徑了
// const imagesPath = path.join(process.cwd(), 'src', 'media', 'italian_brainrot', 'assets', 'images');

export const command = new SlashCommandBuilder()
    .setName('italian-brainrot') // 或者 'random-media'
    .setDescription('隨機發送一個垃圾AI圖');

export const execute = async (interaction) => {
    await interaction.deferReply();

    try {
        const mediaData = fs.readFileSync(mediaListPath, 'utf-8');
        const mediaArray = JSON.parse(mediaData);

        if (!mediaArray || mediaArray.length === 0) {
            return interaction.editReply('嗚嗚... 媒體清單是空的耶！');
        }

        const randomIndex = Math.floor(Math.random() * mediaArray.length);
        const selectedItem = mediaArray[randomIndex];
        console.log(`隨機選擇的項目: ${selectedItem.name}`);

        // 直接從 JSON 中取得影片的 URL
        const videoUrl = selectedItem.video_links;
        if (!videoUrl) {
            console.error(`項目 ${selectedItem.name} 缺少 video_url`);
            return interaction.editReply('啊！這個項目好像沒有影片連結耶... (´•̥ω•̥`)');
        }

        // 使用我們的共用工具來修復連結
        const fixedVideoUrl = fixSocialLinks(videoUrl);

        // 【最終修正】組合一則包含標題和連結的純文字訊息
        const replyContent = `✨ **${selectedItem.name}** ✨\n${fixedVideoUrl}`;

        // 發送最終的回覆
        await interaction.editReply({
            content: replyContent,
            // 確保 embeds 和 files 都是空的
        });

    } catch (error) {
        console.error("執行指令時發生錯誤:", error);
        await interaction.editReply('糟糕，執行指令時發生了未知的錯誤！');
    }
};
