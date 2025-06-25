// src/core/utils.js

/**
 * 接收一段文字，尋找其中所有支援的社群連結，並將其轉換為修復後的連結。
 * @param {string} text - 包含連結的原始文字。
 * @returns {string} - 連結被替換過的全新文字。
 */
export function fixSocialLinks(text) {
    if (!text) return '';

    // 這個 Regex 和我們的邏輯都集中在這裡，成為唯一的真實來源
    const linkRegex = /https?:\/\/(?:www\.)?(twitter|x|instagram|facebook|bilibili|tiktok)\.com\/\S+/g;

    // 使用 String.prototype.replace() 搭配一個替換函式，功能更強大
    return text.replace(linkRegex, (url) => {
        console.log(`[Link Fixer] 偵測到連結: ${url}`);
        if (/twitter\.com/.test(url)) {
            return url.replace('twitter.com', process.env.TWITTER_FIX_API);
        }
        if (/x\.com/.test(url)) {
            return url.replace('x.com', process.env.X_FIX_API);
        }
        if (/instagram\.com/.test(url)) {
            return url.replace('instagram.com', process.env.IG_FIX_API);
        }
        if (/bilibili\.com/.test(url)) {
            return url.replace(/(?:www\.)?bilibili\.com/, process.env.BILIBILI_FIX_API);
        }
        if (/facebook\.com/.test(url)) {
            return url.replace(/www\.facebook\.com|facebook\.com/, process.env.DC_FIX_API);
        }
        if (/tiktok\.com/.test(url)) {
            return url.replace(/(?:www\.)?tiktok\.com/, process.env.TIKTOK_FIX_API);
        }
        // 如果沒有匹配的規則，返回原 URL
        return url;
    });
}