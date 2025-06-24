import { SlashCommandBuilder } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';

export const command = new SlashCommandBuilder()
    .setName('leave')
    .setDescription('讓機器人離開目前的語音頻道');

export const execute = async (interaction) => {
    const connection = getVoiceConnection(interaction.guild.id);

    if (!connection) {
        return interaction.reply({ 
            content: '咦？我現在沒有在任何語音頻道裡呀！', 
            ephemeral: true 
        });
    }

    connection.destroy();
    await interaction.reply('好的，先告退囉！下次再找我玩～ (´,,•ω•,,)♡');
};