const express = require('express');
const path = require('path');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let users = {};
function getUser(id){
  if(!users[id]) users[id] = { id, balance: 0, coins: 0, referrals: 0, totalEarned: 0 };
  return users[id];
}

app.get('/api/user/:id', (req, res)=>{
  const u = getUser(req.params.id);
  const ref = req.query.ref;
  if(ref && ref !== req.params.id && !u.referredBy){
    u.referredBy = ref;
    const referrer = getUser(ref);
    // OPTION 1 - Lower referral: $0.10 + 10 Coins (was $0.50 + 50)
    referrer.balance += 0.10;
    referrer.coins += 10;
    referrer.referrals += 1;
  }
  res.json({ success: true, user: u });
});

app.post('/api/watch-ad', (req, res)=>{
  const { userId } = req.body;
  const u = getUser(userId);
  // OPTION 1 - Lower reward: $0.002 + 2 Coins (was $0.02 + 10)
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
  if(method !== 'TRC20' && method !== 'BEP20') return res.json({ success: false, message: 'USDT ONLY - TRC20 or BEP20' });
  if(!details || details.length < 10) return res.json({ success: false, message: 'Invalid wallet' });
  if(u.balance >= amount){ u.balance -= amount; }
  else if(u.coins >= 5000){ u.coins -= 5000; }
  console.log(`WITHDRAW: User ${userId} - $5 USDT - ${method} - ${details}`);
  res.json({ success: true, user: u, message: `✅ Withdraw $5 USDT (${method}) requested! Paid within 24h to ${details}` });
});

app.get('/api/trending', async (req, res)=>{
  res.json({ videos: [] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Server running on ' + PORT));
