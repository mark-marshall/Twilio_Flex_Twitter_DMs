// ================== Package Imports ==================
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const server = require('./server');
const ngrok = require('ngrok');

// ================== Server Setup ==================
const port = parseInt(process.env.PORT || '7000');

ngrok
  .connect({
    proto: 'http',
    addr: port,
    subdomain: process.env.NGROK_SUBDOMAIN,
    authtoken: process.env.NGROK_TOKEN,
    region: 'eu',
  })
  .then(() => {
    server.listen(port, () =>
      console.log(`===== Server running on port ${port} =====`)
    );
  });
