const express = require('express');
const path = require('path');
const startBot = require('./bot');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let users = {};
function getUser(userId){
  if(!users[userId]){
    users[userId] = { id: userId, balance: 0, coins: 0, withdrawals: [], referrals: [] };
  }
  return users[userId];
}

app.get('/api/user/:id', (req, res) => {
  const userId = req.params.id;
  const ref = req.query.ref;
  const u = getUser(userId);
  if(ref && ref !== userId && !u.referredBy){
    u.referredBy = ref;
    const referrer = getUser(ref);
    referrer.balance += 0.50;
    referrer.coins += 50;
    referrer.referrals.push(userId);
  }
  res.json({ success: true, user: u });
});

app.get('/api/trending', (req, res) => {
  res.json({ success: true, videos: [
    {id:'kJQP7kiw5Fk', title:'Luis Fonsi - Despacito ft. Daddy Yankee', channel:'Luis Fonsi', views:'8.5B views', category:'music'},
    {id:'JGwWNGJdvx8', title:'Ed Sheeran - Shape of You', channel:'Ed Sheeran', views:'6.2B views', category:'music'},
    {id:'RgKAFK5djSk', title:'Wiz Khalifa - See You Again', channel:'Wiz Khalifa', views:'6.5B views', category:'music'},
    {id:'OPf0YbXqDm0', title:'Mark Ronson - Uptown Funk ft. Bruno Mars', channel:'Mark Ronson', views:'5.4B views', category:'music'},
    {id:'9bZkp7q19f0', title:'PSY - GANGNAM STYLE', channel:'officialpsy', views:'5.1B views', category:'viral'},
    {id:'Papuv5v5s9g', title:'MrBeast - $456,000 Squid Game In Real Life!', channel:'MrBeast', views:'650M views', category:'gaming'},
    {id:'eKFTSSKCzWA', title:'BTS - Dynamite', channel:'HYBE LABELS', views:'1.9B views', category:'music'},
    {id:'kXYiU_JCYtU', title:'Numb - Linkin Park', channel:'Linkin Park', views:'2.4B views', category:'music'},
    {id:'hTWKbfoikeg', title:'Smells Like Teen Spirit - Nirvana', channel:'Nirvana', views:'2B views', category:'music'},
    {id:'60ItHLz5WEA', title:'Alan Walker - Faded', channel:'Alan Walker', views:'3.8B views', category:'music'}
  ]});
});

app.post('/api/watch-ad', (req, res) => {
  const { userId } = req.body;
  const u = getUser(userId);
  u.balance += 0.02;
  u.coins += 10;
  res.json({ success: true, user: { balance: u.balance, coins: u.coins } });
});

app.post('/api/convert', (req, res) => {
  const { userId, coins } = req.body;
  const u = getUser(userId);
  if(u.coins < coins || coins < 1000) return res.json({ success:false, message:'Need 1000 Coins' });
  const dollars = coins / 1000;
  u.coins -= coins;
  u.balance += dollars;
  res.json({ success:true, message:`✅ Converted ${coins} Coins = $${dollars.toFixed(2)}`, user:{ balance:u.balance, coins:u.coins } });
});

app.post('/api/withdraw', (req, res) => {
  const { userId, amount, coins, method, details } = req.body;
  const u = getUser(userId);
  const net = (method || 'TRC20').toUpperCase();
  if(coins && coins >= 5000){
    if(u.coins < 5000) return res.json({ success:false, message:'Not enough coins' });
    u.coins -= 5000;
    u.withdrawals.push({ type:'coins', coins:5000, amount:5, method:'USDT ' + net, details, date:new Date().toISOString(), status:'pending' });
    return res.json({ success:true, message:'✅ Withdraw $5 USDT ('+net+') requested! Paid within 24h', user:{ balance:u.balance, coins:u.coins } });
  }
  if(u.balance < 5) return res.json({ success:false, message:`Need $5. You have $${u.balance.toFixed(2)}` });
  const pay = amount || u.balance; u.balance = 0;
  u.withdrawals.push({ type:'cash', amount:pay, method:'USDT ' + net, details, date:new Date().toISOString(), status:'pending' });
  res.json({ success:true, message:`✅ Withdraw $${pay.toFixed(2)} USDT (${net}) requested! Paid within 24h`, user:{ balance:u.balance, coins:u.coins } });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

try{
  if(process.env.BOT_TOKEN) startBot();
  else console.log('No BOT_TOKEN - bot skipped, web only');
}catch(e){ console.log('Bot error:', e.message); }

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
