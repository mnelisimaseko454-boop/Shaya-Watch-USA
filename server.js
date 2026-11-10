app.post('/api/withdraw', (req, res) => {
  const { userId, amount, coins, method, details } = req.body;
  const u = getUser(userId);
  const net = (method || 'TRC20').toUpperCase();
  if(coins && coins >= 5000){
    if(u.coins < 5000) return res.json({ success:false, message:'Not enough coins' });
    u.coins -= 5000;
    u.withdrawals.push({ type:'coins', coins:5000, amount:5, method:'USDT ' + net, details, date:new Date().toISOString(), status:'pending' });
    save(); return res.json({ success:true, message:'✅ Withdraw $5 USDT ('+net+') requested! Paid within 24h', user:{ balance:u.balance, coins:u.coins } });
  }
  if(u.balance < 5) return res.json({ success:false, message:`Need $5. You have $${u.balance.toFixed(2)}` });
  const pay = amount || u.balance; u.balance = 0;
  u.withdrawals.push({ type:'cash', amount:pay, method:'USDT ' + net, details, date:new Date().toISOString(), status:'pending' });
  save(); res.json({ success:true, message:`✅ Withdraw $${pay.toFixed(2)} USDT (${net}) requested! Paid within 24h`, user:{ balance:u.balance, coins:u.coins } });
});
