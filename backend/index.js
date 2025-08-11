const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const { createClient } = require('redis');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Redis client setup
const REDIS_URL = process.env.REDIS_URL || 'redis://default:FLnxkIZytEzbyILWMyYYdoMdPAEYQQlP@caboose.proxy.rlwy.net:24360';
const redisClient = createClient({
  url: REDIS_URL
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

(async () => {
  await redisClient.connect();
})();


app.post('/api/generate', async (req, res) => {
  const localPart = crypto.randomBytes(5).toString('hex');
  if (redisClient.isReady) {
    await redisClient.hSet('emails', localPart, JSON.stringify([]));
  }
  res.json({ email: `${localPart}@zhongkai.click` });
});

app.post('/api/email-inbound', async (req, res) => {
  try {
    const { to, from, subject, text, html, headers } = req.body;
    let localPart = (typeof to === 'string' ? to : to?.address)?.split('@')[0];

    if (!localPart) {
      return res.status(400).send('Invalid "to" field');
    }

    if (redisClient.isReady) {
      const existingEmailsRaw = await redisClient.hGet('emails', localPart);
      let emails = existingEmailsRaw ? JSON.parse(existingEmailsRaw) : [];
      
      const emailData = { from, to, subject, text, html, headers, receivedAt: new Date() };
      emails.push(emailData);

      await redisClient.hSet('emails', localPart, JSON.stringify(emails));
    }

    res.status(200).send('Email stored');
  } catch (error) {
    console.error('Error processing email:', error);
    res.status(500).send(`Server error: ${error.message}`);
  }
});

app.get('/api/emails/:localPart', async (req, res) => {
  const { localPart } = req.params;
  if (redisClient.isReady) {
    const emailsRaw = await redisClient.hGet('emails', localPart);
    res.json(emailsRaw ? JSON.parse(emailsRaw) : []);
  } else {
    res.json([]);
  }
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

process.on('SIGINT', async () => {
  if (redisClient.isReady) {
    await redisClient.quit();
  }
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
}); 