const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const { createClient } = require('redis');
const { simpleParser } = require('mailparser');

const app = express();

app.use(cors());
app.use(express.text({ type: 'text/plain', limit: '10mb' })); // To handle raw email
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

const REDIS_URL = process.env.REDIS_URL || 'redis://default:FLnxkIZytEzbyILWMyYYdoMdPAEYQQlP@caboose.proxy.rlwy.net:24360';
const redisClient = createClient({
  url: REDIS_URL,
  socket: { reconnectStrategy: retries => Math.min(retries * 50, 5000) }
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('Connecting to Redis...'));
redisClient.on('ready', () => console.log('Redis client is ready.'));
redisClient.on('end', () => console.log('Redis connection has been closed.'));

app.post('/api/generate', async (req, res) => {
  try {
    const localPart = crypto.randomBytes(5).toString('hex');
    if (redisClient.isReady) {
      await redisClient.hSet('emails', localPart, JSON.stringify([]));
      res.json({ email: `${localPart}@zhongkai.click` });
    } else {
      res.status(503).json({ error: 'Service not ready.' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/email-inbound', async (req, res) => {
  try {
    const from = req.headers['x-email-from'];
    const to = req.headers['x-email-to'];
    const localPart = to?.split('@')[0];

    if (!localPart) {
      return res.status(400).send('Invalid "to" header');
    }

    const parsedEmail = await simpleParser(req.body);
    const emailData = {
      from: parsedEmail.from.text,
      to: parsedEmail.to.text,
      subject: parsedEmail.subject,
      text: parsedEmail.text,
      html: parsedEmail.html || '',
      headers: Object.fromEntries(parsedEmail.headers),
      receivedAt: new Date(),
    };
    
    if (!redisClient.isReady) {
      return res.status(503).send('Database not available');
    }

    const existingEmailsRaw = await redisClient.hGet('emails', localPart);
    if (existingEmailsRaw === null) {
      return res.status(404).send('Address not found.');
    }

    let emails = JSON.parse(existingEmailsRaw);
    emails.push(emailData);
    await redisClient.hSet('emails', localPart, JSON.stringify(emails));

    res.status(200).send('Email stored');
  } catch (error) {
    res.status(500).send(`Server error: ${error.message}`);
  }
});

app.get('/api/emails/:localPart', async (req, res) => {
  const { localPart } = req.params;
  if (redisClient.isReady) {
    try {
      const emailsRaw = await redisClient.hGet('emails', localPart);
      res.json(emailsRaw ? JSON.parse(emailsRaw) : []);
    } catch (err) {
      res.status(500).json([]);
    }
  } else {
    res.status(503).json([]);
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date(),
    dependencies: { redis: redisClient.isReady ? 'ready' : 'connecting' }
  };
  res.status(200).json(health);
});

process.on('SIGINT', async () => {
  if (redisClient.isReady) {
    await redisClient.quit();
  }
  process.exit(0);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  redisClient.connect().catch(err => {
    console.error('Failed to connect to Redis after server start:', err);
  });
}); 