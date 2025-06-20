import { SlashCommandBuilder } from "discord.js";
import { useAppStore } from '@/store/app'; // 引入我們的狀態儲存

export const command = new SlashCommandBuilder()
    .setName("monitor")
    .setDescription("控制對頻道的訊息監控")
    // 【新增這一行】設置 DM 權限為 false
    .setDMPermission(false) 
    .addSubcommand(subcommand =>
        subcommand
            .setName('start')
            .setDescription('開啟對目前頻道的訊息監控')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('stop')
            .setDescription('關閉對目前頻道的訊息監控')
    );

export const execute = async (interaction) => {
    // 檢查使用者使用的是哪個子命令 (start 還是 stop)
    const subCommand = interaction.options.getSubcommand();
    const appStore = useAppStore();
    const channelId = interaction.channel.id;
    const isCurrentlyMonitoring = appStore.monitoringChannels.has(channelId);

    if (subCommand === 'start') {
        if (isCurrentlyMonitoring) {
            await interaction.reply({ content: "⚠️ 這個頻道已經在監控中了！", ephemeral: true });
        } else {
            appStore.monitoringChannels.add(channelId);
            appStore.chatHistories.set(channelId, []); // 為頻道建立空的歷史紀錄
            await interaction.reply({ content: "✅ 好的，我現在會開始關注這個頻道的對話了。", ephemeral: true });
        }
    } else if (subCommand === 'stop') {
        if (!isCurrentlyMonitoring) {
            await interaction.reply({ content: "⚠️ 這個頻道目前沒有在監控中。", ephemeral: true });
        } else {
            appStore.monitoringChannels.delete(channelId);
            appStore.chatHistories.delete(channelId); // 同時刪除歷史紀錄
            await interaction.reply({ content: "⏹️ 好的，我已經停止關注本頻道的對話了。", ephemeral: true });
        }
    }
};