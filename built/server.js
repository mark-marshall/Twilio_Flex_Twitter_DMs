"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
exports.__esModule = true;
// ================== Package Imports ==================
var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');
var createHmac = require('crypto').createHmac;
var twilio = require('twilio');
var base64 = require('base-64');
var fetch = require('node-fetch');
var Twitter = require('twit');
// ================== Util Imports ==================
var consts_1 = require("./consts");
// ================== Initialise Clients ==================
var client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
var twitterClient = new Twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token: process.env.TWITTER_ACCESS_KEY,
    access_token_secret: process.env.TWITTER_ACCESS_SECRET
});
// ================== Initialise App ==================
var app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
// ================== Endpoints ==================
// EP1: Sense check
app.get('/', function (req, res) {
    res.status(200).json({ message: 'Alive' });
});
// EP2: Twitter Security Check: https://developer.twitter.com/en/docs/twitter-api/enterprise/account-activity-api/guides/securing-webhooks
app.get('/twebhooks', function (req, res) {
    console.log('hi');
    var crc_token = req.query.crc_token;
    var hmac = createHmac('sha256', process.env.TWITTER_CONSUMER_SECRET)
        .update(crc_token)
        .digest('base64');
    var resMsg = "sha256=" + hmac;
    res.status(200).json({ response_token: resMsg });
});
// EP3: Webhook from Twitter Customer -> Send Chat to Flex Agent
app.post('/twebhooks', function (req, res) {
    if (req.body.direct_message_events) {
        var users = req.body.users;
        var user = users[Object.keys(users)[0]];
        var name_1 = user.name;
        var handle = user.screen_name;
        if (handle !== process.env.TWITTER_CO_HANDLE) {
            var msg = req.body.direct_message_events[0].message_create.message_data.text;
            sendMessageToFlex(msg, handle);
        }
    }
    res.sendStatus(200);
});
// EP4: Webhook from Flex Agent -> Send Twitter DM to Customer
app.post('/fromFlex', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var handle, msg, type;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!(req.body.Source === 'SDK')) return [3 /*break*/, 2];
                return [4 /*yield*/, getUserFromChannel(req.body.ChannelSid)];
            case 1:
                handle = _a.sent();
                msg = req.body.Body;
                type = req.body.Type || 'none';
                sendMessageToTwitter(msg, handle, type);
                _a.label = 2;
            case 2:
                res.sendStatus(200);
                return [2 /*return*/];
        }
    });
}); });
// EP4: Webhook from Flex Channel Updates -> Delete Channel?
app.post('/fromFlexChannelUpdate', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        try {
            // Opportunity to do a warm close here
            res.sendStatus(200);
        }
        catch (e) {
            console.error(e);
        }
        return [2 /*return*/];
    });
}); });
// EP5: Get all conversations for a user -> Stitches all interactions
// @body { "handle": "@twitterHandle" }
app.get('/getInteractionHistory', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var handle, interactions, e_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                handle = req.body.handle;
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, getInteractionsForUser(handle)];
            case 2:
                interactions = _a.sent();
                res.status(200).json({ interactions: interactions });
                return [3 /*break*/, 4];
            case 3:
                e_1 = _a.sent();
                console.error(e_1);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// ================== Functions ==================
var createNewChannel = function (flexFlowSid, flexChatService, identity) { return __awaiter(void 0, void 0, void 0, function () {
    var flexChannel, channelExists, e_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 6, , 7]);
                return [4 /*yield*/, hasOpenChannel(identity)];
            case 1:
                channelExists = _a.sent();
                return [4 /*yield*/, client.flexApi.channel.create({
                        flexFlowSid: flexFlowSid,
                        identity: "@" + identity,
                        chatUserFriendlyName: "Chat with @" + identity,
                        chatFriendlyName: "Chat with @" + identity,
                        target: "@" + identity
                    })];
            case 2:
                // Identity is unique per channel, if we create a new channel that already exists, there's no penalty to that
                // We need the channel SID anyway to send the message so we go ahead and do this every time
                flexChannel = _a.sent();
                if (!!channelExists) return [3 /*break*/, 5];
                return [4 /*yield*/, client.chat
                        .services(flexChatService)
                        .channels(flexChannel.sid)
                        .webhooks.create({
                        type: 'webhook',
                        configuration: {
                            method: 'POST',
                            url: 'https://mmarshall.eu.ngrok.io/fromFlex',
                            filters: ['onMessageSent']
                        }
                    })];
            case 3:
                _a.sent();
                return [4 /*yield*/, client.chat
                        .services(flexChatService)
                        .channels(flexChannel.sid)
                        .webhooks.create({
                        type: 'webhook',
                        configuration: {
                            method: 'POST',
                            url: 'https://mmarshall.eu.ngrok.io/fromFlexChannelUpdate',
                            filters: ['onChannelUpdated']
                        }
                    })];
            case 4:
                _a.sent();
                _a.label = 5;
            case 5: return [3 /*break*/, 7];
            case 6:
                e_2 = _a.sent();
                console.error(e_2);
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/, flexChannel];
        }
    });
}); };
var sendChatMessage = function (serviceSid, channelSid, senderId, msg) { return __awaiter(void 0, void 0, void 0, function () {
    var params, res;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                params = new URLSearchParams();
                params.append('Body', msg);
                params.append('From', senderId);
                return [4 /*yield*/, fetch("https://chat.twilio.com/v2/Services/" + serviceSid + "/Channels/" + channelSid + "/Messages", {
                        method: 'post',
                        body: params,
                        headers: {
                            'X-Twilio-Webhook-Enabled': 'true',
                            Authorization: "Basic " + base64.encode(process.env.TWILIO_ACCOUNT_SID + ":" + process.env.TWILIO_AUTH_TOKEN)
                        }
                    })];
            case 1:
                res = _a.sent();
                return [2 /*return*/, res];
        }
    });
}); };
// Do SMS with flex, close the channel --> check the attributes obj and see what the status is on it!
var hasOpenChannel = function (senderId) { return __awaiter(void 0, void 0, void 0, function () {
    var channels, openChannelExists;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, client.chat
                    .services(process.env.FLEX_CHAT_SERVICE)
                    .channels.list()];
            case 1:
                channels = _a.sent();
                openChannelExists = channels.filter(function (c) {
                    var _a = JSON.parse(c.attributes), from = _a.from, status = _a.status;
                    return from.includes(senderId) && status !== 'INACTIVE';
                }).length > 0;
                return [2 /*return*/, openChannelExists];
        }
    });
}); };
var getInteractionsForUser = function (senderId) { return __awaiter(void 0, void 0, void 0, function () {
    var interactions, channels, userChannels, _i, userChannels_1, channel, messageList;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                interactions = [];
                return [4 /*yield*/, client.chat
                        .services(process.env.FLEX_CHAT_SERVICE)
                        .channels.list()];
            case 1:
                channels = _a.sent();
                userChannels = channels
                    .filter(function (c) { return JSON.parse(c.attributes).from === senderId; })
                    .sort(function (a, b) { return (a.dateCreated < b.dateCreated ? 1 : -1); });
                _i = 0, userChannels_1 = userChannels;
                _a.label = 2;
            case 2:
                if (!(_i < userChannels_1.length)) return [3 /*break*/, 5];
                channel = userChannels_1[_i];
                return [4 /*yield*/, client.chat
                        .services(process.env.FLEX_CHAT_SERVICE)
                        .channels(channel.sid)
                        .messages.list()];
            case 3:
                messageList = _a.sent();
                interactions = __spreadArray(__spreadArray([], interactions), messageList);
                _a.label = 4;
            case 4:
                _i++;
                return [3 /*break*/, 2];
            case 5: return [2 /*return*/, interactions];
        }
    });
}); };
var getUserFromChannel = function (channelId) { return __awaiter(void 0, void 0, void 0, function () {
    var chat, user;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, client.chat
                    .services(process.env.FLEX_CHAT_SERVICE)
                    .channels(channelId)
                    .fetch()];
            case 1:
                chat = _a.sent();
                user = JSON.parse(chat.attributes).from;
                return [2 /*return*/, user];
        }
    });
}); };
var sendMessageToFlex = function (msg, senderId) { return __awaiter(void 0, void 0, void 0, function () {
    var flexChanel;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, createNewChannel(process.env.FLEX_FLOW_SID, process.env.FLEX_CHAT_SERVICE, senderId)];
            case 1:
                flexChanel = _a.sent();
                // TODO: This any is a Channel Instance
                return [4 /*yield*/, sendChatMessage(process.env.FLEX_CHAT_SERVICE, flexChanel.sid, senderId, msg)];
            case 2:
                // TODO: This any is a Channel Instance
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var sendMessageToTwitter = function (msg, handle, type) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        // Get the users id from their handle
        twitterClient.get('users/show', {
            screen_name: handle
        }, 
        // TODO: Get TW Types
        function (error, data, response) {
            if (error) {
                console.error(error);
            }
            var formattedMsg = msg;
            var options = [];
            // Check if the operator used the Options keyword and split the question from the options
            // Format from agent is: 'txt Options [listOptions (- add description)]
            if (msg.includes('Options')) {
                var msgSplit = msg.split('Options');
                var optionsSplit = msgSplit[1].split(',');
                formattedMsg = msgSplit[0];
                options = optionsSplit.map(function (op) {
                    var optionDescSplit = op.split('-');
                    var option = {
                        label: optionDescSplit[0]
                    };
                    if (optionDescSplit.length > 1) {
                        option.description = optionDescSplit[1];
                    }
                    return option;
                });
            }
            else {
                for (var keyword in consts_1.quickReplyConfig) {
                    if (msg.includes(keyword)) {
                        options = consts_1.quickReplyConfig[keyword];
                    }
                }
            }
            // Package the quick reply object
            var optionsObj = options.length > 0
                ? {
                    quick_reply: {
                        type: 'options',
                        options: options
                    }
                }
                : {};
            // Package the cta object
            var ctaObj = type === 'CTA'
                ? {
                    ctas: [
                        {
                            type: 'web_url',
                            label: 'Buy Now',
                            url: process.env.STRIPE_PAYMENT_LINK
                        },
                    ]
                }
                : {};
            // Send the message to Twitter
            twitterClient.post('direct_messages/events/new', {
                event: {
                    type: 'message_create',
                    message_create: {
                        target: {
                            recipient_id: data.id_str
                        },
                        message_data: __assign(__assign({ text: formattedMsg }, optionsObj), ctaObj)
                    }
                }
            }, function (error) {
                if (error) {
                    console.error(error);
                }
            });
        });
        return [2 /*return*/];
    });
}); };
module.exports = app;
