import { defineStore } from "pinia";
import { Collection } from "discord.js";

export const useAppStore = defineStore('app',{
  state: () => ({
    client: null,
    commandsActionMap: new Collection(),
    // 使用 Set 來存放正在監控的頻道 ID，查詢和刪除速度快
    monitoringChannels: new Set(),
    // 使用 Map 來為每個頻道儲存各自的對話歷史
    // 結構：{ '頻道ID_1': [訊息1, 訊息2], '頻道ID_2': [...] }
    chatHistories: new Map(),
  }),
  getters: {},
  actions: {},
});