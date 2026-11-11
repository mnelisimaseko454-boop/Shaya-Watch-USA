const TelegramBot = require('node-telegram-bot-api');
const BOT_TOKEN = process.env.BOT_TOKEN || "PUT_YOUR_BOT_TOKEN_HERE";
const WEB_APP_URL = process.env.WEB_APP_URL || "https://shaya-watch-usa.onrender.com";

function startBot(){
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
    bot.sendMessage(msg.chat.id, "HOW IT WORKS:\n\n1. Tap OPEN\n2. Watch Ad = +$0.002 + 2 Coins\n3. Every 3rd ad = Bonus Interstitial Ad\n4. Convert 1000 Coins = $1\n5. At $5, withdraw in USDT ONLY\n6. Share link = $0.10 per friend\n\nWITHDRAW:\nSend your USDT wallet address (TRC20 / BEP20)\nMin $5 - Paid within 24h").catch(e => console.log(e.message));
  });
  bot.on("polling_error", (err) => console.log("Polling error:", err.message));
  console.log("USA Bot started...");
  return bot;
}
module.exports = startBot;
