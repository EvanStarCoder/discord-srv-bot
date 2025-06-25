import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';

// 定義您的資料和媒體檔案路徑
const mediaListPath = path.join(process.cwd(), 'src', 'media', 'italian_brainrot', 'italian_brainrot_data.json');
const imagesPath = path.join(process.cwd(), 'src', 'media', 'italian_brainrot', 'assets', 'images');
const videosPath = path.join(process.cwd(), 'src', 'media', 'italian_brainrot', 'assets', 'videos');

export const command = new SlashCommandBuilder()
    .setName('italian-brainrot')
    .setDescription('隨機發送一個垃圾AI圖');

export const execute = async (interaction) => {
    await interaction.deferReply();

    try {
        // 1. 讀取並解析 JSON 檔案
        const mediaData = fs.readFileSync(mediaListPath, 'utf-8');
        const mediaArray = JSON.parse(mediaData);

        if (!mediaArray || mediaArray.length === 0) {
            return interaction.editReply('嗚嗚... 媒體清單是空的耶！');
        }

        // 2. 從陣列中隨機挑選一個項目
        const randomIndex = Math.floor(Math.random() * mediaArray.length);
        const selectedItem = mediaArray[randomIndex];
        console.log(`隨機選擇的項目: ${selectedItem.name}`);
        // 3. 準備要上傳的圖片和影片檔案
        const imagePath = path.join(imagesPath, selectedItem.img);
        const videoPath = path.join(videosPath, selectedItem.mp4);

        // 檢查檔案是否存在
        if (!fs.existsSync(imagePath) || !fs.existsSync(videoPath)) {
            console.error(`檔案缺失: ${selectedItem.name} - Img: ${imagePath} or MP4: ${videoPath}`);
            return interaction.editReply('啊！好像找不到對應的圖片或影片檔案耶... (´•̥ω•̥`)');
        }
        
        // 使用 AttachmentBuilder 來建立附件
        const imageAttachment = new AttachmentBuilder(imagePath);
        const videoAttachment = new AttachmentBuilder(videoPath);

        const encodedImageName = encodeURIComponent(selectedItem.img);
        // 4. 建立要顯示的嵌入式訊息 (Embed)
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`✨ ${selectedItem.name} ✨`)
            // 【關鍵】使用 attachment:// 協議來引用我們即將上傳的圖片
            .setImage(`attachment://${encodedImageName}`);

        // 5. 發送回覆，同時包含 Embed 和 檔案附件
        await interaction.editReply({
            embeds: [embed],
            files: [imageAttachment, videoAttachment]
        });

    } catch (error) {
        console.error("執行 random-media 指令時發生錯誤:", error);
        await interaction.editReply('糟糕，執行指令時發生了未知的錯誤！');
    }
};  