const express = require('express');
const path = require('path');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

const BOT_TOKEN = process.env.BOT_TOKEN || "";
const WEB_APP_URL = process.env.WEB_APP_URL || "https://shaya-watch-usa.onrender.com";
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";
const CHANNEL_ID = process.env.CHANNEL_ID || "@ShayaWatchUSA";

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- USERS STORAGE ---
const DATA_FILE = path.join(__dirname, 'users.json');
let users = {};
try { if(fs.existsSync(DATA_FILE)){ users = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '{}'); } } catch(e){ users = {}; }
function saveUsers(){ try{ fs.writeFileSync(DATA_FILE, JSON.stringify(users)); }catch(e){ console.log('Save failed:', e.message); } }
function getUser(id){ if(!users[id]) users[id] = { id, balance: 0, coins: 0, referrals: 0, totalEarned: 0, vipMult: 1, vipUntil: 0, vipPlan: null }; return users[id]; }

// --- VIP PLANS ---
const VIP_PLANS = {
  vip7: { stars: 50, days: 7, mult: 2, title: "VIP 7 Days - 2x Earnings" },
  vip30: { stars: 150, days: 30, mult: 3, title: "VIP 30 Days - 3x Earnings" },
  vipLife: { stars: 500, days: 3650, mult: 5, title: "VIP Lifetime - 5x Earnings" }
};
function getVipMult(u){ if(u.vipUntil && Date.now() < u.vipUntil) return u.vipMult || 1; u.vipMult = 1; return 1; }
function pickPlan(plan){ if(plan === 'vip7') return VIP_PLANS.vip7; if(plan === 'vip30') return VIP_PLANS.vip30; if(plan === 'vipLife') return VIP_PLANS.vipLife; return null; }

// --- TRENDING FROM YOUTUBE (FROM OLD bot.js) ---
async function getTrending(max = 10) {
  if(!YOUTUBE_API_KEY) return [];
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=US&maxResults=${max}&key=${YOUTUBE_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.items || [];
  } catch(e){ console.log('Trending error:', e.message); return []; }
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

// --- API ROUTES ---
app.get('/api/user/:id', (req, res)=>{
  const u = getUser(req.params.id);
  const ref = req.query.ref;
  if(ref && ref !== req.params.id && !u.referredBy){
    u.referredBy = ref;
    const referrer = getUser(ref);
    referrer.balance += 0.10; referrer.coins += 10; referrer.referrals += 1; saveUsers();
  }
  res.json({ success: true, user: { ...u, vipMult: getVipMult(u) } });
});

app.post('/api/watch-ad', (req, res)=>{
  const u = getUser(req.body.userId);
  const mult = getVipMult(u);
  const earnCash = 0.002 * mult; const earnCoins = 2 * mult;
  u.balance += earnCash; u.coins += earnCoins; u.totalEarned += earnCash; saveUsers();
  res.json({ success: true, user: { ...u, vipMult: mult }, message: `✅ +$${earnCash.toFixed(4)} + ${earnCoins} Coins!${mult > 1 ? ` (VIP ${mult}x)` : ''}` });
});

app.post('/api/convert', (req, res)=>{
  const { userId, coins } = req.body; const u = getUser(userId);
  if(u.coins < coins) return res.json({ success: false, message: 'Not enough coins' });
  const dollars = coins / 1000; u.coins -= coins; u.balance += dollars; saveUsers();
  res.json({ success: true, user: u, message: `✅ Converted ${coins} Coins = $${dollars.toFixed(2)}` });
});

app.post('/api/withdraw', (req, res)=>{
  const { userId, amount, coins, method, details } = req.body; const u = getUser(userId);
  if(u.balance < amount && u.coins < 5000) return res.json({ success: false, message: 'Need $5 OR 5000 Coins' });
  if(method !== 'TRC20' && method !== 'BEP20') return res.json({ success: false, message: 'USDT ONLY' });
  if(u.balance >= amount) u.balance -= amount; else if(u.coins >= 5000) u.coins -= 5000; saveUsers();
  console.log(`WITHDRAW: User ${userId} - $5 USDT - ${method} - ${details}`);
  res.json({ success: true, user: u, message: `✅ Withdraw $5 USDT (${method}) requested!` });
});

app.post('/api/create-vip', async (req, res)=>{
  const { userId, plan } = req.body; const p = pickPlan(plan);
  if(!p) return res.json({ success: false, message: 'Invalid plan' });
  if(!BOT_TOKEN) return res.json({ success: false, message: 'Bot not configured' });
  try{
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendInvoice`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: userId, title: p.title, description: `Shaya Watch USA ${p.title}. Earn ${p.mult}x per ad for ${p.days} days.`, payload: `vip_${plan}_${userId}`, provider_token: "", currency: "XTR", prices: [{ label: p.title, amount: p.stars }], start_parameter: "vip" }) });
    const d = await r.json(); if(!d.ok) return res.json({ success: false, message: d.description || 'Invoice failed - Open bot chat first, then tap START' });
    res.json({ success: true });
  }catch(e){ res.json({ success: false, message: 'Invoice failed' }); }
});

// REAL TRENDING API FOR WEB APP
app.get('/api/trending', async (req,res)=>{
  const videos = await getTrending(10);
  const formatted = videos.map(v => ({ id: v.id, title: v.snippet.title, channel: v.snippet.channelTitle, views: v.statistics.viewCount, thumbnail: v.snippet.thumbnails?.medium?.url, url: `https://youtu.be/${v.id}` }));
  res.json({ videos: formatted });
});

// --- BOT ---
let bot = null;
function startBot(){
  if(!BOT_TOKEN){ console.log('BOT_TOKEN not set'); return null; }
  try{
    bot = new TelegramBot(BOT_TOKEN, { polling: true });

    bot.on('pre_checkout_query', (q) => { bot.answerPreCheckoutQuery(q.id, true).catch(e => console.log(e.message)); });

    // Handle Unlock Top 10 button + other callback buttons
    bot.on('callback_query', async (q) => {
      if(q.data === 'unlock_top10'){
        try{
          await bot.answerCallbackQuery(q.id);
          await bot.sendInvoice(q.message.chat.id, 'Shaya Watch USA - Top 10', 'Unlock USA Trending #6 to #10 right now', `top10_${q.message.chat.id}`, "", "XTR", [{ label: 'Top 10 Unlock', amount: 10 }], { start_parameter: 'top10' });
        }catch(e){ console.log('Top10 invoice error:', e.message); }
      }
    });

    bot.on('message', async (msg) => {
      if(msg.successful_payment){
        try{
          const payload = msg.successful_payment.invoice_payload || "";
          const parts = payload.split('_');
          // VIP payment: vip_vip7_123456
          if(parts[0] === 'vip'){
            const plan = parts[1]; const userId = parts[2] || msg.chat.id.toString(); const p = pickPlan(plan);
            if(p){ const u = getUser(userId); u.vipMult = p.mult; u.vipUntil = Date.now() + (p.days * 24 * 60 * 60 * 1000); u.vipPlan = plan; saveUsers(); bot.sendMessage(msg.chat.id, `✅ VIP ACTIVATED!\n\n⭐ ${p.title}\nYou now earn ${p.mult}x on every ad!\nExpires: ${new Date(u.vipUntil).toLocaleDateString()}`).catch(()=>{}); }
          }
          // TOP 10 payment: top10_123456
          if(parts[0] === 'top10'){
            const videos = await getTrending(10);
            const paid5 = formatVideos(videos.slice(5, 10), 5);
            bot.sendMessage(msg.chat.id, `✅ *Payment Received! Here is your VIP Top 10* 🎉\n\n${paid5}Thanks for supporting Shaya Watch USA 🇺🇸`, { parse_mode: 'Markdown' }).catch(()=>{});
          }
        }catch(e){ console.log("Payment error:", e.message); }
      }
    });

    bot.onText(/\/start(.*)/, async (msg) => {
      const videos = await getTrending(10);
      const free5 = formatVideos(videos.slice(0, 5), 0);
      bot.sendMessage(msg.chat.id, `🇺🇸 SHAYA WATCH USA - Earn Real Cash!\n\nWatch Ads + Trending Videos, Get Paid in USDT!\n\n✅ 1 Ad = $0.002 + 2 Coins\n✅ 1000 Coins = $1\n✅ Withdraw at $5 - USDT ONLY\n✅ Referral: $0.10 + 10 Coins per friend!\n\n🔥 *USA TRENDING NOW* 🇺🇸\n\n${free5}🔒 *Top 6-10 are locked*\nUnlock for just 10 ⭐`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [
          [{ text: "🚀 OPEN SHAYA WATCH USA", web_app: { url: WEB_APP_URL } }],
          [{ text: "🔓 Unlock Top 10 - 10 ⭐", callback_data: "unlock_top10" }]
        ]}
      }).catch(e => console.log("Send error:", e.message));
    });

    bot.onText(/\/trending/, async (msg) => {
      const videos = await getTrending(10);
      const free5 = formatVideos(videos.slice(0, 5), 0);
      bot.sendMessage(msg.chat.id, `🔥 *USA TRENDING NOW* 🇺🇸\n\n${free5}🔒 Top 6-10 locked - 10 ⭐ to unlock`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: "🔓 Unlock Top 10 - 10 ⭐", callback_data: "unlock_top10" }]] } }).catch(()=>{});
    });

    bot.onText(/\/vip/, (msg) => {
      bot.sendMessage(msg.chat.id, `⭐ SHAYA VIP - Earn Faster!\n\n⭐ VIP 7 Days - 50 Stars - 2x\n⭐ VIP 30 Days - 150 Stars - 3x\n👑 VIP Lifetime - 500 Stars - 5x`, { reply_markup: { inline_keyboard: [[{ text: "⭐ OPEN VIP", web_app: { url: WEB_APP_URL } }]] } }).catch(()=>{});
    });

    bot.onText(/\/help/, (msg) => {
      bot.sendMessage(msg.chat.id, "HOW IT WORKS:\n\n1. Tap OPEN\n2. Watch Ad = +$0.002 + 2 Coins (VIP = up to 5x)\n3. Convert 1000 Coins = $1\n4. At $5, withdraw in USDT ONLY\n5. Share link = $0.10 per friend").catch(e => console.log(e.message));
    });

    bot.on("polling_error", (err) => console.log("Polling error:", err.message));
    console.log("USA Bot started...");
    return bot;
  }catch(e){ console.log('Bot start failed: ' + e.message); return null; }
}

// --- AUTO-POST TO CHANNEL EVERY 6 HOURS ---
async function autoPost() {
  if(!bot) return;
  const videos = await getTrending(5);
  if(!videos.length) return;
  const msg = `🔥 *USA TRENDING NOW* 🇺🇸\n*Shaya Watch USA - Auto Update*\n\n${formatVideos(videos, 0)}Get Top 10 in bot 👉 @ShayaWatchUSAEarnBot`;
  try {
    await bot.sendMessage(CHANNEL_ID, msg, { parse_mode: 'Markdown' });
    console.log('✅ Auto-posted at', new Date().toLocaleString());
  } catch (e) { console.log('❌ Auto-post failed:', e.message); }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>{
  console.log('Server running on ' + PORT);
  startBot();
  // Every 6 hours: 00:00, 06:00, 12:00, 18:00
  cron.schedule('0 */6 * * *', autoPost);
  // Post once on start
  setTimeout(autoPost, 5000);
});
