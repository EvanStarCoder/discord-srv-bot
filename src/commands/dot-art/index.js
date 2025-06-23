import { SlashCommandBuilder } from 'discord.js';

// API 的位址
const API_ENDPOINT = `http://${process.env.DC_FIX_API}/generate-dot-art/`//'http://127.0.0.1:8041/generate-dot-art/';

export const command = new SlashCommandBuilder()
    .setName('dot-art')
    .setDescription('將您上傳的圖片轉換成酷酷的點陣圖！')
    .addAttachmentOption(option =>
        option.setName('image')
            .setDescription('請上傳一張圖片')
            .setRequired(true)
    );

export const execute = async (interaction) => {
    await interaction.deferReply();

    const imageAttachment = interaction.options.getAttachment('image');

    if (!imageAttachment.contentType?.startsWith('image/')) {
        await interaction.editReply('嗚嗚... 這好像不是圖片檔案耶！( ´•̥̥̥ω•̥̥̥` )');
        return;
    }

    try {
        const imageUrl = imageAttachment.url;

        // 【修改】向我們的 Python API 發送請求
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image_url: imageUrl,
            }),
        });

        if (!response.ok) {
            throw new Error(`API 請求失敗，狀態碼: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        const result = data.dot_art;
        
        if (result.length > 1990) {
            await interaction.editReply('唔哇！圖片太大了，轉出來的點陣圖會塞不下啦！請試試小一點或簡單一點的圖片～');
        } else {
            await interaction.editReply(`這是為您特製的點陣圖！喜歡嗎？(っ≧▽≦)っ\n\`\`\`${result}\`\`\``);
        }

    } catch (error) {
        console.error("點陣圖轉換失敗:", error);
        await interaction.editReply('啊！魔法失敗了... (つд⊂) 呼叫圖片處理服務時發生了錯誤。');
    }
};