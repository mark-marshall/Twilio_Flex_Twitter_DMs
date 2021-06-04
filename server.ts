// ================== Type Imports ==================
import { json } from 'body-parser';
import { Request, Response } from 'express';

// ================== Package Imports ==================
const express = require('express');
const bodyParser = require('body-parser');
const { createHmac } = require('crypto');
const twilio = require('twilio');
const base64 = require('base-64');
const fetch = require('node-fetch');
const Twitter = require('twit');

// ================== Initialise Clients ==================
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const twitterClient = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token: process.env.TWITTER_ACCESS_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_SECRET,
});

// ================== Initialise App ==================
const app = express();
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ================== Endpoints ==================
// EP1: Sense check
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ message: 'Alive' });
});

// EP2: Twitter Security Check: https://developer.twitter.com/en/docs/twitter-api/enterprise/account-activity-api/guides/securing-webhooks
app.get('/twebhooks', (req: Request, res: Response) => {
  const { crc_token } = req.query;
  const hmac = createHmac('sha256', process.env.TWITTER_CONSUMER_SECRET)
    .update(crc_token)
    .digest('base64');
  const resMsg = `sha256=${hmac}`;
  res.status(200).json({ response_token: resMsg });
});

// EP3: Webhook from Twitter Customer -> Send Chat to Flex Agent
app.post('/twebhooks', function (req: Request, res: Response) {
  if (req.body.direct_message_events) {
    const users = req.body.users;
    const user = users[Object.keys(users)[0]];
    const name = user.name;
    const handle = user.screen_name;
    if (handle !== process.env.TWITTER_CO_HANDLE) {
      const msg =
        req.body.direct_message_events[0].message_create.message_data.text;
      sendMessageToFlex(msg, handle);
    }
  }
  res.sendStatus(200);
});

// EP3: Webhook from Flex Agent -> Send Twitter DM to Customer
app.post('/fromFlex', async (req: Request, res: Response) => {
  // Source will be 'API' for Twitter customer side, 'SDK' for Flex agent side
  if (req.body.Source === 'SDK') {
    // Get the username, get the Twitter id, then send DM via the id
    const userName = await getUserFromChannel(req.body.ChannelSid);
    twitterClient.get(
      'users/show',
      {
        screen_name: userName,
      },
      (error: any, data: any, response: any) => {
        if (error) {
          console.error(error);
        }
        twitterClient.post(
          'direct_messages/events/new',
          {
            event: {
              type: 'message_create',
              message_create: {
                target: {
                  recipient_id: data.id_str,
                },
                message_data: {
                  text: req.body.Body,
                },
              },
            },
          },
          (error: any) => {
            if (error) {
              console.error(error);
            }
          }
        );
      }
    );
  }
  res.sendStatus(200);
});

// EP4: Webhook from Flex Channel Updates -> Delete Channel?
app.post('/fromFlexChannelUpdate', async (req: Request, res: Response) => {
  try {
    await client.chat
      .services(process.env.FLEX_CHAT_SERVICE)
      .channels(req.body.ChannelSid)
      .remove();
    res.sendStatus(200);
  } catch (e) {
    console.error(e);
  }
});

// ================== Functions ==================
const createNewChannel = async (
  flexFlowSid: string,
  flexChatService: string,
  identity: string
) => {
  let flexChannel;
  try {
    const channelExists = await hasOpenChannel(identity);
    // Identity is unique per channel, if we create a new channel that already exists, there's no penalty to that
    // We need the channel SID anyway to send the message so we go ahead and do this every time
    flexChannel = await client.flexApi.channel.create({
      flexFlowSid,
      identity,
      chatUserFriendlyName: `@${identity}`,
      chatFriendlyName: `Twitter DM with @${identity}`,
      target: identity,
    });
    // Each service can have up to 5 webhooks and duplicating webhooks results in duplicate flows between Twitter and Flex
    if (!channelExists) {
      await client.chat
        .services(flexChatService)
        .channels(flexChannel.sid)
        .webhooks.create({
          type: 'webhook',
          'configuration.method': 'POST',
          'configuration.url': `https://mmarshall.eu.ngrok.io/fromFlex?channel=${flexChannel.sid}`,
          'configuration.filters': ['onMessageSent'],
        });
      await client.chat
        .services(flexChatService)
        .channels(flexChannel.sid)
        .webhooks.create({
          type: 'webhook',
          'configuration.method': 'POST',
          'configuration.url': `https://mmarshall.eu.ngrok.io/fromFlexChannelUpdate?channel=${flexChannel.sid}`,
          'configuration.filters': ['onChannelUpdated'],
        });
    }
  } catch (e) {
    console.error(e);
  }
  return flexChannel;
};

const sendChatMessage = async (
  serviceSid: string,
  channelSid: string,
  senderId: string,
  msg: string
) => {
  const params = new URLSearchParams();
  params.append('Body', msg);
  params.append('From', senderId);
  const res = await fetch(
    `https://chat.twilio.com/v2/Services/${serviceSid}/Channels/${channelSid}/Messages`,
    {
      method: 'post',
      body: params,
      headers: {
        'X-Twilio-Webhook-Enabled': 'true',
        Authorization: `Basic ${base64.encode(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        )}`,
      },
    }
  );
  return res;
};

const hasOpenChannel = async (senderId: string) => {
  const chats = await client.chat
    .services(process.env.FLEX_CHAT_SERVICE)
    .channels.list();
  const openChannelExists =
    chats.filter((c: any) => JSON.parse(c.attributes).from === senderId)
      .length > 0;
  return openChannelExists;
};

const getUserFromChannel = async (channelId: string) => {
  const chat = await client.chat
    .services(process.env.FLEX_CHAT_SERVICE)
    .channels(channelId)
    .fetch();
  const user = JSON.parse(chat.attributes).from;
  return user;
};

const sendMessageToFlex = async (msg: string, senderId: string) => {
  const flexChanel = await createNewChannel(
    process.env.FLEX_FLOW_SID as string,
    process.env.FLEX_CHAT_SERVICE as string,
    senderId
  );
  await sendChatMessage(
    process.env.FLEX_CHAT_SERVICE as string,
    flexChanel.sid,
    senderId,
    msg
  );
};

module.exports = app;
