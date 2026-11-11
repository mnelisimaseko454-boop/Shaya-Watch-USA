const express = require('express');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const BOT_TOKEN = process.env.BOT_TOKEN || "";
const WEB_APP_URL = process.env.WEB_APP_URL || "https://shaya-watch-usa.onrender.com";
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
let users = {};
function getUser(id){ if(!users[id]) users[id] = { id, balance: 0, coins: 0, referrals: 0, totalEarned: 0, vipMult: 1, vipUntil: 0, vipPlan: null }; return users[id]; }
const VIP_PLANS = { vip7: { stars: 50, days: 7, mult: 2, title: "VIP 7 Days - 2x Earnings" }, vip30: { stars: 150, days: 30, mult: 3, title: "VIP 30 Days - 3x Earnings" }, vipLife: { stars: 500, days: 3650, mult: 5, title: "VIP Lifetime - 5x Earnings" } };
function getVipMult(u){ if(u.vipUntil && Date.now() < u.vipUntil) return u.vipMult || 1; u.vipMult = 1; return 1; }
app.get('/api/user/:id', (req, res)=>{ const u = getUser(req.params.id); const ref = req.query.ref; if(ref && ref !== req.params.id && !u.referredBy){ u.referredBy = ref; const referrer = getUser(ref); referrer.balance += 0.10; referrer.coins += 10; referrer.referrals += 1; } res.json({ success: true, user: { ...u, vipMult: getVipMult(u) } }); });
app.post('/api/watch-ad', (req, res)=>{ const u = getUser(req.body.userId); const mult = getVipMult(u); const earnCash = 0.002 * mult; const earnCoins = 2 * mult; u.balance += earnCash; u.coins += earnCoins; u.totalEarned += earnCash; res.json({ success: true, user: { ...u, vipMult: mult }, message: `✅ +$${earnCash.toFixed(4)} + ${earnCoins} Coins!${mult > 1 ? ` (VIP ${mult}x)` : ''}` }); });
app.post('/api/convert', (req, res)=>{ const { userId, coins } = req.body; const u = getUser(userId); if(u.coins < coins) return res.json({ success: false, message: 'Not enough coins' }); const dollars = coins / 1000; u.coins -= coins; u.balance += dollars; res.json({ success: true, user: u, message: `✅ Converted ${coins} Coins = $${dollars.toFixed(2)}` }); });
app.post('/api/withdraw', (req, res)=>{ const { userId, amount, coins, method, details } = req.body; const u = getUser(userId); if(u.balance < amount && u.coins < 5000) return res.json({ success: false, message: 'Need $5 OR 5000 Coins' }); if(method !== 'TRC20' && method !== 'BEP20') return res.json({ success: false, message: 'USDT ONLY' }); if(u.balance >= amount) u.balance -= amount; else if(u.coins >= 5000) u.coins -= 5000; console.log(`WITHDRAW: User ${userId} - $5 USDT - ${method} - ${details}`); res.json({ success: true, user: u, message: `✅ Withdraw $5 USDT (${method}) requested!` }); });
app.post('/api/create-vip', async (req, res)=>{
  const { userId, plan } = req.body;
  const p = VIP_PLANS;
  if(!p) return res.json({ success: false, message: 'Invalid plan' });
  if(!BOT_TOKEN) return res.json({ success: false, message: 'Bot not configured' });
  try{
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendInvoice`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: userId, title: p.title, description: `Shaya Watch USA ${p.title}. Earn ${p.mult}x per ad for ${p.days} days.`, payload: `vip_${plan}_${userId}`, provider_token: "", currency: "XTR", prices: [{ label: p.title, amount: p.stars }], start_parameter: "vip" }) });
    const d = await r.json();
    if(!d.ok) return res.json({ success: false, message: d.description || 'Invoice failed - Open bot chat first, then tap START' });
    res.json({ success: true });
  }catch(e){ res.json({ success: false, message: 'Invoice failed' }); }
});
app.get('/api/trending', (req,res)=> res.json({ videos: [] }));
function startBot(){
  if(!BOT_TOKEN){ console.log('BOT_TOKEN not set'); return null; }
  try{
    const bot = new TelegramBot(BOT_TOKEN, { polling: true });
    bot.on('pre_checkout_query', (q) => { bot.answerPreCheckoutQuery(q.id, true).catch(e => console.log(e.message)); });
    bot.on('message', (msg) => {
      if(msg.successful_payment){
        try{
          const payload = msg.successful_payment.invoice_payload || "";
          const parts = payload.split('_');
          if(parts[0] === 'vip'){
            const plan = parts[1];
            const userId = parts[2] || msg.chat.id.toString();
            const p = VIP_PLANS;
            if(p){
              const u = getUser(userId); u.vipMult = p.mult; u.vipUntil = Date.now() + (p.days * 24 * 60 * 60 * 1000); u.vipPlan = plan;
              bot.sendMessage(msg.chat.id, `✅ VIP ACTIVATED!\n\n⭐ ${p.title}\nYou now earn ${p.mult}x on every ad!\nExpires: ${new Date(u.vipUntil).toLocaleDateString()}`).catch(()=>{});
            }
          }
        }catch(e){ console.log("VIP payment error:", e.message); }
      }
    });
    bot.onText(/\/start(.*)/, (msg, match) => { bot.sendMessage(msg.chat.id, `🇺🇸 SHAYA WATCH USA - Earn Real Cash!\n\nWatch Ads + Trending Videos, Get Paid in USDT!\n\n✅ 1 Ad = $0.002 + 2 Coins\n✅ 1000 Coins = $1\n✅ Withdraw at $5 - USDT ONLY\n✅ Referral: $0.10 + 10 Coins per friend!\n\n⭐ VIP 7 Days - 50 Stars = 2x\n⭐ VIP 30 Days - 150 Stars = 3x\n👑 VIP Lifetime - 500 Stars = 5x\n\nTap below to start earning 👇`, { reply_markup: { inline_keyboard: [[{ text: "🚀 OPEN SHAYA WATCH USA", web_app: { url: WEB_APP_URL } }]] } }).catch(e => console.log("Send error:", e.message)); });
    bot.onText(/\/vip/, (msg) => { bot.sendMessage(msg.chat.id, `⭐ SHAYA VIP - Earn Faster!\n\n⭐ VIP 7 Days - 50 Stars - 2x\n⭐ VIP 30 Days - 150 Stars - 3x\n👑 VIP Lifetime - 500 Stars - 5x`, { reply_markup: { inline_keyboard: [[{ text: "⭐ OPEN VIP", web_app: { url: WEB_APP_URL } }]] } }).catch(()=>{}); });
    bot.onText(/\/help/, (msg) => { bot.sendMessage(msg.chat.id, "HOW IT WORKS:\n\n1. Tap OPEN\n2. Watch Ad = +$0.002 + 2 Coins (VIP = up to 5x)\n3. Convert 1000 Coins = $1\n4. At $5, withdraw in USDT ONLY\n5. Share link = $0.10 per friend").catch(e => console.log(e.message)); });
    bot.on("polling_error", (err) => console.log("Polling error:", err.message));
    console.log("USA Bot started...");
    return bot;
  }catch(e){ console.log('Bot start failed: ' + e.message); return null; }
}
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>{ console.log('Server running on ' + PORT); startBot(); });
