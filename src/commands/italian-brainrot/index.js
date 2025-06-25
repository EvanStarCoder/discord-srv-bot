import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';

// 您的路徑定義不變
const mediaListPath = path.join(process.cwd(), 'src', 'media', 'italian_brainrot', 'italian_brainrot_data.json');
const imagesPath = path.join(process.cwd(), 'src', 'media', 'italian_brainrot', 'assets', 'images');
// 【移除】影片路徑的定義不再需要
// const videosPath = path.join(process.cwd(), 'src', 'media', 'italian_brainrot', 'assets', 'videos');

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

        // --- 處理圖片的部分維持不變 ---
        const imagePath = path.join(imagesPath, selectedItem.img);
        if (!fs.existsSync(imagePath)) {
            console.error(`圖片檔案缺失: ${imagePath}`);
            return interaction.editReply('啊！好像找不到對應的圖片檔案耶... (´•̥ω•̥`)');
        }
        const imageAttachment = new AttachmentBuilder(imagePath);

        // --- 【修改】處理影片的部分 ---
        // 直接從 JSON 中取得影片的 URL
        const videoUrl = selectedItem.video_links;
        if (!videoUrl) {
            console.error(`項目 ${selectedItem.name} 缺少 video_url`);
            return interaction.editReply('啊！這個項目好像沒有影片連結耶... (´•̥ω•̥`)');
        }

        // --- 建立 Embed 的部分維持不變 ---
        const encodedImageName = encodeURIComponent(selectedItem.img);
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`✨ ${selectedItem.name} ✨`)
            .setImage(`attachment://${encodedImageName}`);

        // --- 【修改】最終回覆的結構 ---
        // 我們現在發送一則訊息，它既有 content (影片連結)，也有 embeds 和 files (圖片)
        await interaction.editReply({
            content: videoUrl, // 將影片 URL 作為訊息的主要內容
            embeds: [embed],
            files: [imageAttachment] // files 陣列中現在只剩下圖片
        });

    } catch (error) {
        console.error("執行指令時發生錯誤:", error);
        await interaction.editReply('糟糕，執行指令時發生了未知的錯誤！');
    }
};