// Shaya Watch USA - Trending + Stars Paywall + Auto-post every 6 hours
require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const cron = require('node-cron');

const bot = new Telegraf(process.env.BOT_TOKEN);
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = process.env.CHANNEL_ID; // e.g. @ShayaWatchUSA

// --- 1. GET TRENDING FROM YOUTUBE ---
async function getTrending(max = 10) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=US&maxResults=${max}&key=${YOUTUBE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.items || [];
}

function formatVideos(videos, start = 0) {
  let msg = ``;
  videos.forEach((v, i) => {
    const title = v.snippet.title;
    const channel = v.snippet.channelTitle;
    const views = Number(v.statistics.viewCount).toLocaleString();
    msg += `${start + i + 1}. *${title}*\n👤 ${channel} • 👁️ ${views}\n🔗 https://youtu.be/${v.id}\n\n`;
  });
  return msg;
}

// --- 2. /start - FREE TOP 5 + PAYWALL ---
bot.start(async (ctx) => {
  const videos = await getTrending(10);
  const free5 = formatVideos(videos.slice(0, 5), 0);

  await ctx.reply(
    `🔥 *USA TRENDING NOW* 🇺🇸\n*Shaya Watch USA*\n\n${free5}🔒 *Top 6-10 are locked*\nUnlock full Top 10 for just 10 ⭐`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔓 Unlock Top 10 - 10 ⭐', 'unlock_top10')],
      ])
    }
  );
});

// --- 3. WHEN USER TAPS UNLOCK - SEND STARS INVOICE ---
bot.action('unlock_top10', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.replyWithInvoice({
    title: 'Shaya Watch USA - Top 10',
    description: 'Unlock USA Trending #6 to #10 right now',
    payload: 'top10_unlock',
    provider_token: '', // Leave empty for Stars - Telegram handles it
    currency: 'XTR', // XTR = Telegram Stars
    prices: [{ label: 'Top 10 Unlock', amount: 10 }], // 10 Stars
  });
});

// --- 4. AUTO-APPROVE PAYMENT ---
bot.on('pre_checkout_query', async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

// --- 5. AFTER PAYMENT - SEND TOP 6-10 ---
bot.on('successful_payment', async (ctx) => {
  const videos = await getTrending(10);
  const paid5 = formatVideos(videos.slice(5, 10), 5);
  await ctx.reply(`✅ *Payment Received! Here is your VIP Top 10* 🎉\n\n${paid5}Thanks for supporting Shaya Watch USA 🇺🇸`, { parse_mode: 'Markdown' });
});

// --- 6. AUTO-POST TO CHANNEL EVERY 6 HOURS ---
async function autoPost() {
  const videos = await getTrending(5);
  const msg = `🔥 *USA TRENDING NOW* 🇺🇸\n*Shaya Watch USA - Auto Update*\n\n${formatVideos(videos, 0)}Get Top 10 in bot 👉 @ShayaWatchUSAEarnBot`;
  
  try {
    await bot.telegram.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });
    console.log('✅ Auto-posted at', new Date().toLocaleString());
  } catch (e) {
    console.log('❌ Auto-post failed:', e.message);
  }
}

// Run every 6 hours: at 00:00, 06:00, 12:00, 18:00
cron.schedule('0 */6 * * *', autoPost);

// Post once when bot starts too
autoPost();

bot.launch();
console.log('🤖 Shaya Watch USA Bot is running...');
