const app = require('./server.js');
const startBot = require('./bot.js');
const PORT = process.env.PORT || 10000;
startBot();
app.listen(PORT, '0.0.0.0', () => console.log(`SHAYA USA running on port ${PORT}`));
