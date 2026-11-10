const TelegramBot = require('node-telegram-bot-api');
const BOT_TOKEN = process.env.BOT_TOKEN || "PUT_YOUR_BOT_TOKEN_HERE";
const WEB_APP_URL = process.env.WEB_APP_URL || "PUT_YOUR_RENDER_URL_HERE";
function startBot(){
  const bot = new TelegramBot(BOT_TOKEN, { polling: true });
  bot.onText(/\/start(.*)/, (msg, match) => {
    const startParam = (match[1] || "").trim();
    bot.sendMessage(msg.chat.id,
`🇺🇸 SHAYA WATCH USA - Earn Real Cash!

Watch Ads + Trending Videos, Get Paid!

✅ 1 Ad = $0.02 + 10 🪙 Profit Coins
✅ 1000 Coins = $1
✅ Withdraw at $5 - PayPal / Cash App / Venmo
✅ 5000 Coins = $5

🔥 Trending Videos Auto-Update Every Hour
🎵 Music • 🎮 Gaming • ⚽ Sports • 😂 Viral

🔗 Referral: $0.50 + 50 Coins per friend!

Tap below to start earning 👇`, {
      reply_markup: { inline_keyboard: { text: "🚀 OPEN SHAYA WATCH USA", web_app: { url: WEB_APP_URL } } }
    });
  });
  bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id, "HOW IT WORKS:\n\n1. Tap OPEN\n2. Watch Ad = +$0.02 + 10 Coins\n3. Every 3rd ad = Bonus Interstitial Ad\n4. Convert 1000 Coins = $1\n5. At $5, withdraw via PayPal / Cash App\n6. Share link = $0.50 per friend");
  });
  console.log("USA Bot started...");
  return bot;
}
module.exports = startBot;
