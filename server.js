const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = path.join(__dirname, 'db.json');
let db = { users: {} };
if (fs.existsSync(DB_FILE)) { try { db = JSON.parse(fs.readFileSync(DB_FILE)); } catch(e){} }
function save(){ fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function getUser(userId){
  userId = String(userId);
  if(!db.users[userId]) db.users[userId] = { userId, username:"", firstName:"", balance:0, coins:0, totalWatched:0, referrals:0, referralEarnings:0, referredBy:null, referralCounted:false, withdrawals:[] };
  return db.users[userId];
}

// === SELF-UPDATING TRENDING - USA ===
let trendingCache = { trending:[], music:[], gaming:[], lastFetch:0 };
const FALLBACK = {
  trending: ["kXYiU_JCYtU","JGwWNGJdvx8","60ItHLz5WEA","papuvlVeZg8","9bZkp7q19f0","RgKAFK5djSk","OPf0YbXqDm0","hLQl3WQQoQ0","7PCkvCPvDXk","CevxZvSJLk8"],
  music: ["JGwWNGJdvx8","papuvlVeZg8","7PCkvCPvDXk","hLQl3WQQoQ0","YQHsXMglC9A","2Vv-BfVoq4g","CevxZvSJLk8","OPf0YbXqDm0"],
  gaming: ["8aRor905cCw","M99vV8s2nF0","6JnN1DmbqoU","XqZsoesa55w","kffacxfA7G4"]
};
async function fetchYouTubeTrending(){
  // Uses YouTube Data API if key exists, else fallback
  const API_KEY = process.env.YOUTUBE_API_KEY || "";
  if(!API_KEY) return FALLBACK;
  try{
    const fetchCat = async (cat) => {
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&regionCode=US&videoCategoryId=${cat}&maxResults=30&key=${API_KEY}`;
      const r = await fetch(url); const j = await r.json();
      return (j.items || []).map(v => v.id);
    };
    const trending = await fetchCat(0);
    const music = await fetchCat(10);
    const gaming = await fetchCat(20);
    return { trending: trending.length?trending:FALLBACK.trending, music: music.length?music:FALLBACK.music, gaming: gaming.length?gaming:FALLBACK.gaming };
  }catch(e){ return FALLBACK; }
}
app.get('/api/trending', async (req, res) => {
  const now = Date.now();
  if(now - trendingCache.lastFetch > 3600000 || trendingCache.trending.length===0){
    const data = await fetchYouTubeTrending();
    trendingCache = { ...data, lastFetch: now };
  }
  res.json(trendingCache);
});

app.get('/api/user/:userId', (req, res) => {
  const u = getUser(req.params.userId);
  res.json({ balance: u.balance, coins: u.coins, totalWatched: u.totalWatched });
});
app.post('/api/claim-reward', (req, res) => {
  const { userId, username, firstName, referredBy } = req.body;
  const u = getUser(userId);
  u.username = username || u.username; u.firstName = firstName || u.firstName;
  if(referredBy && referredBy !== String(userId) && !u.referredBy) u.referredBy = referredBy;
  u.balance = Math.round((u.balance + 0.02) * 100) / 100;
  u.coins += 10; u.totalWatched += 1;
  if(u.referredBy && !u.referralCounted && u.totalWatched >= 10){
    u.referralCounted = true;
    const ref = getUser(u.referredBy);
    ref.balance = Math.round((ref.balance + 0.50) * 100) / 100;
    ref.coins += 50; ref.referrals += 1; ref.referralEarnings = Math.round((ref.referralEarnings + 0.50) * 100) / 100;
  }
  save();
  res.json({ success: true, user: { balance: u.balance, coins: u.coins, totalWatched: u.totalWatched } });
});
app.post('/api/coins', (req, res) => {
  const u = getUser(req.body.userId);
  if(typeof req.body.coins === 'number' && req.body.coins > u.coins) u.coins = req.body.coins;
  save(); res.json({ success: true, coins: u.coins });
});
app.post('/api/withdraw', (req, res) => {
  const { userId, amount, coins, method, details } = req.body;
  const u = getUser(userId);
  if(coins && coins >= 5000){
    if(u.coins < 5000) return res.json({ success:false, message:'Not enough coins' });
    u.coins -= 5000;
    u.withdrawals.push({ type:'coins', coins:5000, amount:5, method, details, date:new Date().toISOString(), status:'pending' });
    save(); return res.json({ success:true, message:'✅ Withdraw $5 (5000 Coins) requested! PayPal / Cash App', user:{ balance:u.balance, coins:u.coins } });
  }
  if(u.balance < 5) return res.json({ success:false, message:`Need $5. You have $${u.balance.toFixed(2)}` });
  const pay = amount || u.balance; u.balance = 0;
  u.withdrawals.push({ type:'cash', amount:pay, method, details, date:new Date().toISOString(), status:'pending' });
  save(); res.json({ success:true, message:`✅ Withdraw $${pay.toFixed(2)} requested!`, user:{ balance:u.balance, coins:u.coins } });
});
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
module.exports = app;
