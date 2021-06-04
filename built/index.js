"use strict";
// ================== Package Imports ==================
var path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
var server = require('./server');
var ngrok = require('ngrok');
// ================== Server Setup ==================
var port = parseInt(process.env.PORT || '7000');
ngrok
    .connect({
    proto: 'http',
    addr: port,
    subdomain: process.env.NGROK_SUBDOMAIN,
    authtoken: process.env.NGROK_TOKEN,
    region: 'eu'
})
    .then(function () {
    server.listen(port, function () {
        return console.log("===== Server running on port " + port + " =====");
    });
});
