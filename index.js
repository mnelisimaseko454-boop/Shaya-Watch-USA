const express = require('express');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN = process.env.BOT_TOKEN || "";
const WEB_APP_URL = process.env.WEB_APP_URL || "https://shaya-watch-usa.onrender.com";

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let users = {};
function getUser(id){
  if(!users[id]) users[id] = { id, balance: 0, coins: 0, referrals: 0, totalEarned: 0 };
  return users[id];
}

// ===== API =====
app.get('/api/user/:id', (req, res)=>{
  const u = getUser(req.params.id);
  const ref = req.query.ref;
  if(ref && ref !== req.params.id && !u.referredBy){
    u.referredBy = ref;
    const referrer = getUser(ref);
    referrer.balance += 0.10;
    referrer.coins += 10;
    referrer.referrals += 1;
  }
  res.json({ success: true, user: u });
});

app.post('/api/watch-ad', (req, res)=>{
  const u = getUser(req.body.userId);
  u.balance += 0.002;
  u.coins += 2;
  u.totalEarned += 0.002;
  res.json({ success: true, user: u, message: '✅ +$0.002 + 2 Coins!' });
});

app.post('/api/convert', (req, res)=>{
  const { userId, coins } = req.body;
  const u = getUser(userId);
  if(u.coins < coins) return res.json({ success: false, message: 'Not enough coins' });
  const dollars = coins / 1000;
  u.coins -= coins;
  u.balance += dollars;
  res.json({ success: true, user: u, message: `✅ Converted ${coins} Coins = $${dollars.toFixed(2)}` });
});

app.post('/api/withdraw', (req, res)=>{
  const { userId, amount, coins, method, details } = req.body;
  const u = getUser(userId);
  if(u.balance < amount && u.coins < 5000) return res.json({ success: false, message: 'Need $5 OR 5000 Coins' });
  if(method !== 'TRC20' && method !== 'BEP20') return res.json({ success: false, message: 'USDT ONLY' });
  if(u.balance >= amount) u.balance -= amount;
  else if(u.coins >= 5000) u.coins -= 5000;
  console.log(`WITHDRAW: User ${userId} - $5 USDT - ${method} - ${details}`);
  res.json({ success: true, user: u, message: `✅ Withdraw $5 USDT (${method}) requested!` });
});

app.get('/api/trending', (req,res)=> res.json({ videos: [] }));

// ===== TELEGRAM BOT =====
function startBot(){
  if(!BOT_TOKEN){
    console.log('⚠️ BOT_TOKEN not set - Bot skipped, website still running');
    return null;
  }
  console.log('Starting Telegram Bot...');
  try{
    const bot = new TelegramBot(BOT_TOKEN, { polling: true });
    bot.onText(/\/start(.*)/, (msg, match) => {
      bot.sendMessage(msg.chat.id,
`🇺🇸 SHAYA WATCH USA - Earn Real Cash!

Watch Ads + Trending Videos, Get Paid in USDT!

✅ 1 Ad = $0.002 + 2 🪙 Profit Coins
✅ 1000 Coins = $1
✅ Withdraw at $5 - USDT ONLY
✅ 5000 Coins = $5 USDT

🔥 Trending Videos Auto-Update Every Hour
🎵 Music • 🎮 Gaming • ⚽ Sports • 😂 Viral

🔗 Referral: $0.10 + 10 Coins per friend!

💰 Withdrawals paid in USDT (TRC20 / BEP20)

Tap below to start earning 👇`, {
        reply_markup: { inline_keyboard: [[{ text: "🚀 OPEN SHAYA WATCH USA", web_app: { url: WEB_APP_URL } }]] }
      }).catch(e => console.log("Send error:", e.message));
    });
    bot.onText(/\/help/, (msg) => {
      bot.sendMessage(msg.chat.id, "HOW IT WORKS:\n\n1. Tap OPEN\n2. Watch Ad = +$0.002 + 2 Coins\n3. Every 3rd ad = Bonus Interstitial Ad\n4. Convert 1000 Coins = $1\n5. At $5, withdraw in USDT ONLY\n6. Share link = $0.10 per friend").catch(e => console.log(e.message));
    });
    bot.on("polling_error", (err) => console.log("Polling error:", err.message));
    console.log("USA Bot started...");
    return bot;
  }catch(e){
    console.log('Bot start failed, website still running: ' + e.message);
    return null;
  }
}

// ===== START =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>{
  console.log('Server running on ' + PORT);
  startBot();
});
