import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus,
    VoiceConnectionStatus,
    // 【新增】引入這兩個工具來進行深度除錯
    entersState,
    getVoiceConnection,
    generateDependencyReport
} from '@discordjs/voice';
import youtubedl from 'youtube-dl-exec';
import path from 'path';

//const cookieFilePath = path.join(process.cwd(), 'youtube_cookies.txt');

export const command = new SlashCommandBuilder()
    .setName('play')
    .setDescription('播放指定的 YouTube 影片音樂')
    .addStringOption(option =>
        option.setName('url')
            .setDescription('YouTube 影片的 URL 或搜尋關鍵字')
            .setRequired(true)
    );

export const execute = async (interaction) => {
    // 【除錯一】打印依賴報告，檢查 ffmpeg 和 opus 是否正常
    console.log("--- 依賴報告 ---");
    console.log(generateDependencyReport());
    console.log("--------------------");

    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
        return interaction.reply({ 
            content: '你需要先加入一個語音頻道，我才能進來唱歌喔！(つд⊂)', 
            flags: [MessageFlags.Ephemeral] 
        });
    }

    //let connection;
    await interaction.deferReply();

    try {
        const query = interaction.options.getString('url');
        console.log(`正在用 yt-dlp 處理: "${query}"`);

        const videoInfo = await youtubedl(query, {
            quiet: true,
            dumpSingleJson: true,
            defaultSearch: 'ytsearch',
            forceIpv4: true,
            //cookies: cookieFilePath,
        });

        if (!videoInfo) {
            return interaction.editReply(`嗚嗚... 找不到關於 "${query}" 的任何結果耶！`);
        }
        
        const videoTitle = videoInfo.title;
        const videoUrl = videoInfo.webpage_url;
        console.log(`影片資訊獲取成功: ${videoTitle}`);

        const stream = youtubedl.exec(videoUrl, {
            o: '-', 
            q: '', 
            f: 'bestaudio[ext=opus]/bestaudio[ext=m4a]/bestaudio',
            //r: '100K', 
            downloader: 'ffmpeg',
            // downloaderArgs 可以在需要時傳遞額外參數給 ffmpeg
            downloaderArgs: 'ffmpeg_i:-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5',
            forceIpv4: true,
            // //cookies: cookieFilePath,
        });

        stream.catch(error => {
            console.error(`[yt-dlp Process] 子進程執行失敗:`, error.message);
        });

        if (!stream.stdout) {
            throw new Error('無法獲取音訊串流。');
        }
        
        // 【除錯二】監聽 yt-dlp 的 stdout 串流本身
        /*stream.stdout.on('data', chunk => {
            console.log(`[yt-dlp stream] 接收到 ${chunk.length} bytes 的音訊資料`);
        });*/
        // 【修改二】為子進程加上 stderr 監聽器，捕捉最底層的錯誤訊息
        stream.stderr.on('data', data => {
            console.error(`[yt-dlp stderr]: ${data.toString()}`);
        });
        stream.catch(error => {
            console.error(`[yt-dlp Process] 子進程執行失敗:`, error.message);
        });

        stream.stdout.on('error', error => {
            console.error('[yt-dlp stream] 串流發生錯誤:', error);
        });
        
        console.log("音訊串流創建成功，準備連接語音頻道...");

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });

        // 【除錯三】監聽語音連接的狀態變化
        connection.on('stateChange', (oldState, newState) => {
            console.log(`[VoiceConnection] 連接狀態改變: ${oldState.status} -> ${newState.status}`);
        });
        
        const resource = createAudioResource(stream.stdout);
        const player = createAudioPlayer();
        
        // 【除錯四】監聽播放器的狀態變化
        player.on('stateChange', (oldState, newState) => {
            console.log(`[AudioPlayer] 播放器狀態改變: ${oldState.status} -> ${newState.status}`);
        });

        // 【最終修正】重新安排訂閱和播放的順序，並加入等待
        
        // 1. 先將播放器訂閱到連接上
        connection.subscribe(player);
        
        // 2. 播放資源
        player.play(resource);

        // 3. 等待語音連接和播放器都進入「Ready」和「Playing」狀態
        await Promise.all([
            entersState(connection, VoiceConnectionStatus.Ready, 30_000),
            entersState(player, AudioPlayerStatus.Playing, 30_000),
        ]);
        
        console.log("語音連接和播放器均已就緒，音樂應該已成功播放！");
        await interaction.editReply(`🎶 開始播放： **${videoTitle}**`);

        // 4. 等待播放完畢
        await entersState(player, AudioPlayerStatus.Idle, 24 * 60 * 60 * 1000); // 等待最多24小時直到閒置

        stream.stdout.on('end', () => {
            console.log('[yt-dlp stream] 串流已結束');
        });

        player.on(AudioPlayerStatus.Idle, () => {
            console.log('播放器進入閒置狀態，準備斷開連接。');
            if (connection?.state.status !== VoiceConnectionStatus.Destroyed) {
                connection.destroy();
            }
        });

        player.on('error', error => {
            console.error(`播放器錯誤: ${error.message}`);
            // 我們讓 idle 事件來處理斷開，這裡只印出錯誤
        });
    } catch (error) {
        console.error("播放指令執行失敗:", error);
        await interaction.editReply('糟糕，執行播放指令時發生了錯誤！無法開始播放。');
    } /*finally {
        // 無論成功或失敗，最後都確保連接被關閉
        const connection = getVoiceConnection(interaction.guild.id);
        if (connection && connection.state.status !== VoiceConnectionStatus.Destroyed) {
            console.log("指令流程結束，正在斷開連接...");
            connection.destroy();
        }
    }*/
};