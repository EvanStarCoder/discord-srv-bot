import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection,
    generateDependencyReport
} from '@discordjs/voice';
import youtubedl from 'youtube-dl-exec';
import path from 'path';
import { spawn } from 'child_process';
import { PassThrough } from 'stream';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 根據系統選擇 ffmpeg
import ffmpegStatic from 'ffmpeg-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 檢測系統並選擇合適的 ffmpeg 和 yt-dlp 路徑
function getFFmpegPath() {
    if (process.platform === 'linux') {
        // 在 Linux 上優先使用系統的 ffmpeg
        return 'ffmpeg'; // 假設系統已安裝 ffmpeg
    }
    return ffmpegStatic; // Windows 和其他系統使用 ffmpeg-static
}

function getYtDlpPath() {
    const basePath = path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin');
    return process.platform === 'win32' 
        ? path.join(basePath, 'yt-dlp.exe')
        : path.join(basePath, 'yt-dlp');
}

export const command = new SlashCommandBuilder()
    .setName('play')
    .setDescription('播放指定的 YouTube 影片音樂')
    .addStringOption(option =>
        option.setName('url')
            .setDescription('YouTube 影片的 URL 或搜尋關鍵字')
            .setRequired(true)
    );

// 檢查是否為直播
async function isLiveStream(url) {
    try {
        const info = await youtubedl(url, {
            quiet: true,
            dumpSingleJson: true,
            defaultSearch: 'ytsearch',
            forceIpv4: true,
        });
        return info.is_live || info.was_live;
    } catch (error) {
        console.error('檢查直播狀態時出錯:', error);
        return false;
    }
}

// 為直播創建專用的串流處理
function createLiveStream(videoUrl) {
    const ffmpegPath = getFFmpegPath();
    const ytdlpPath = getYtDlpPath();
    console.log(`使用 ffmpeg 路徑: ${ffmpegPath}`);
    console.log(`使用 yt-dlp 路徑: ${ytdlpPath}`);
    
    // 使用 yt-dlp 獲取直播串流 URL
    return new Promise((resolve, reject) => {
        const ytdlp = spawn(ytdlpPath, [
            videoUrl,
            '--get-url',
            '-f', 'bestaudio[ext=opus]/bestaudio[ext=m4a]/bestaudio',
            '--force-ipv4'
        ]);

        let streamUrl = '';
        
        ytdlp.stdout.on('data', (data) => {
            streamUrl += data.toString();
        });

        ytdlp.stderr.on('data', (data) => {
            console.error('[yt-dlp stderr]:', data.toString());
        });

        ytdlp.on('close', (code) => {
            if (code === 0 && streamUrl.trim()) {
                const actualUrl = streamUrl.trim().split('\n')[0];
                console.log('獲取到直播串流 URL:', actualUrl);
                
                // 創建 ffmpeg 進程來處理直播串流
                const ffmpegArgs = [
                    '-reconnect', '1',
                    '-reconnect_streamed', '1',
                    '-reconnect_delay_max', '5',
                    '-i', actualUrl,
                    '-f', 's16le',  // 改用 PCM 格式，更穩定
                    '-ar', '48000',
                    '-ac', '2',
                    '-acodec', 'pcm_s16le',
                    '-vn',
                    'pipe:1'
                ];
                
                const ffmpeg = spawn(ffmpegPath, ffmpegArgs, {
                    stdio: ['pipe', 'pipe', 'pipe']
                });

                // 監聽 ffmpeg 錯誤
                ffmpeg.stderr.on('data', (data) => {
                    const errorMsg = data.toString();
                    // 過濾掉一些正常的 ffmpeg 輸出
                    if (errorMsg.includes('Error') || errorMsg.includes('Failed') || errorMsg.includes('Invalid argument')) {
                        console.error('[ffmpeg stderr]:', errorMsg);
                    }
                });

                ffmpeg.on('error', (error) => {
                    console.error('ffmpeg 進程錯誤:', error);
                    reject(error);
                });

                ffmpeg.on('close', (code) => {
                    console.log(`ffmpeg 進程結束，退出碼: ${code}`);
                });

                resolve(ffmpeg.stdout);
            } else {
                reject(new Error(`無法獲取直播串流 URL，退出碼: ${code}`));
            }
        });

        ytdlp.on('error', (error) => {
            console.error('yt-dlp 進程錯誤:', error);
            reject(error);
        });
    });
}

export const execute = async (interaction) => {
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

    await interaction.deferReply();

    try {
        const query = interaction.options.getString('url');
        console.log(`正在處理: "${query}"`);

        // 獲取影片資訊
        const videoInfo = await youtubedl(query, {
            quiet: true,
            dumpSingleJson: true,
            defaultSearch: 'ytsearch',
            forceIpv4: true,
        });

        if (!videoInfo) {
            return interaction.editReply(`嗚嗚... 找不到關於 "${query}" 的任何結果耶！`);
        }
        
        const videoTitle = videoInfo.title;
        const videoUrl = videoInfo.webpage_url;
        const isLive = videoInfo.is_live || videoInfo.was_live;
        
        console.log(`影片資訊: ${videoTitle} ${isLive ? '(直播)' : '(錄影)'}`);

        let audioStream;

        if (isLive) {
            console.log('檢測到直播，使用專用處理方式...');
            audioStream = await createLiveStream(videoUrl);
        } else {
            console.log('檢測到一般影片，使用標準處理方式...');
            const ffmpegPath = getFFmpegPath();
            
            const stream = youtubedl.exec(videoUrl, {
                o: '-', 
                q: '', 
                f: 'bestaudio[ext=opus]/bestaudio[ext=m4a]/bestaudio',
                forceIpv4: true,
                ffmpegLocation: ffmpegPath,
            });

            stream.stderr.on('data', data => {
                const errorMsg = data.toString();
                if (errorMsg.includes('ERROR')) {
                    console.error(`[yt-dlp stderr]: ${errorMsg}`);
                }
            });

            stream.on('error', error => {
                console.error(`[yt-dlp Process] 子進程執行失敗:`, error.message);
            });

            if (!stream.stdout) {
                throw new Error('無法獲取音訊串流。');
            }

            audioStream = stream.stdout;
        }

        console.log("音訊串流創建成功，準備連接語音頻道...");

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });

        connection.on('stateChange', (oldState, newState) => {
            console.log(`[VoiceConnection] 連接狀態改變: ${oldState.status} -> ${newState.status}`);
        });
        
        const resource = createAudioResource(audioStream, {
            inputType: isLive ? 'raw' : undefined, // 直播使用 raw PCM，一般影片讓系統自動檢測
        });
        const player = createAudioPlayer();
        
        player.on('stateChange', (oldState, newState) => {
            console.log(`[AudioPlayer] 播放器狀態改變: ${oldState.status} -> ${newState.status}`);
            
            // 如果播放器出錯，記錄詳細信息
            if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
                if (newState.reason) {
                    console.log(`播放結束原因: ${newState.reason}`);
                }
            }
        });

        // 訂閱和播放
        connection.subscribe(player);
        player.play(resource);

        // 等待連接和播放器就緒
        try {
            await Promise.all([
                entersState(connection, VoiceConnectionStatus.Ready, 30_000),
                entersState(player, AudioPlayerStatus.Playing, 30_000),
            ]);
            
            console.log("語音連接和播放器均已就緒，音樂開始播放！");
            await interaction.editReply(`🎶 開始播放： **${videoTitle}** ${isLive ? '📡 (直播)' : ''}`);
        } catch (error) {
            console.error('等待播放器就緒時出錯:', error);
            throw new Error('播放器初始化失敗');
        }

        // 處理播放完成
        player.on(AudioPlayerStatus.Idle, () => {
            console.log('播放完成，準備斷開連接。');
            if (connection?.state.status !== VoiceConnectionStatus.Destroyed) {
                connection.destroy();
            }
        });

        player.on('error', error => {
            console.error(`播放器錯誤: ${error.message}`);
            console.error('錯誤詳情:', error);
            if (connection?.state.status !== VoiceConnectionStatus.Destroyed) {
                connection.destroy();
            }
        });

    } catch (error) {
        console.error("播放指令執行失敗:", error);
        await interaction.editReply(`糟糕，執行播放指令時發生了錯誤！\n錯誤訊息: ${error.message}`);
    }
};