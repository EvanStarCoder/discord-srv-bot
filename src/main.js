import { Client, Events, GatewayIntentBits } from 'discord.js'
import vuelnit from '@/core/vue'
import dotenv from 'dotenv';
import { useAppStore } from '@/store/app'
import { loadCommands, loadEvents } from '@/core/loader'

vuelnit();
dotenv.config();
loadCommands();

// Create a new client instance
const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,    // <-- 新增這一行
    GatewayIntentBits.MessageContent,   // <-- 新增這一行 
] 
});
const appStore = useAppStore()
appStore.client = client

loadEvents();
// Log in to Discord with your client's token
client.login(process.env.TOKEN);