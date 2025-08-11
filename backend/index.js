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

// In-memory fallback storage (used if Redis connection fails)
const tempEmails = new Set();
const emailsByAddress = {};

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
    console.log('Connected to Redis');
    
    // Load existing emails from Redis
    await loadEmailsFromRedis();
  } catch (err) {
    console.error('Redis connection error:', err);
    console.log('Using in-memory storage as fallback');
  }
})();

// Load emails from Redis to memory
async function loadEmailsFromRedis() {
  try {
    // Get all temp email addresses
    const keys = await redisClient.keys('email:*');
    
    for (const key of keys) {
      const localPart = key.split(':')[1];
      tempEmails.add(localPart);
      
      // Get emails for this address
      const emails = await redisClient.get(key);
      if (emails) {
        emailsByAddress[localPart] = JSON.parse(emails);
      }
    }
    
    console.log(`Loaded ${tempEmails.size} email addresses from Redis`);
  } catch (err) {
    console.error('Error loading emails from Redis:', err);
  }
}

// Save emails to Redis
async function saveEmailsToRedis(localPart, emails) {
  try {
    if (redisClient.isReady) {
      await redisClient.set(`email:${localPart}`, JSON.stringify(emails));
    }
  } catch (err) {
    console.error('Error saving emails to Redis:', err);
  }
}

// Generate a new temp email
app.post('/api/generate', async (req, res) => {
  const localPart = crypto.randomBytes(5).toString('hex'); // e.g. 'a1b2c3d4e5'
  tempEmails.add(localPart);
  
  // Initialize empty array for this email
  emailsByAddress[localPart] = [];
  
  // Save to Redis
  try {
    if (redisClient.isReady) {
      await redisClient.set(`email:${localPart}`, JSON.stringify([]));
    }
  } catch (err) {
    console.error('Error saving new email to Redis:', err);
  }
  
  res.json({ email: `${localPart}@zhongkai.click` });
});

// Receive email from Cloudflare Worker
app.post('/api/email-inbound', async (req, res) => {
  try {
    console.log('Received email request');
    
    // Check if the request body exists
    if (!req.body) {
      console.error('Empty request body');
      return res.status(400).send('Empty request body');
    }
    
    console.log('Email data:', JSON.stringify(req.body, null, 2));
    
    const { to, from, subject, text, html, headers } = req.body;
    
    // Validate required fields
    if (!to) {
      console.error('Missing "to" field in request');
      return res.status(400).send('Missing "to" field');
    }
    
    // Extract local part from 'to' field
    let localPart;
    let toAddress;
    
    if (typeof to === 'string') {
      // Format: "user@domain.com"
      toAddress = to;
      const parts = to.split('@');
      if (parts.length >= 2) {
        localPart = parts[0];
      } else {
        localPart = to; // Fallback
      }
    } else if (Array.isArray(to)) {
      // Format: [{address: "user@domain.com"}]
      if (to.length > 0 && to[0].address) {
        toAddress = to[0].address;
        localPart = toAddress.split('@')[0];
      } else {
        console.error('Invalid array format for "to" field');
        return res.status(400).send('Invalid "to" field format');
      }
    } else if (to && to.address) {
      // Format: {address: "user@domain.com"}
      toAddress = to.address;
      localPart = toAddress.split('@')[0];
    } else {
      console.error('Invalid format for "to" field:', to);
      return res.status(400).send('Invalid "to" field format');
    }

    console.log(`Processing email for: ${localPart}@zhongkai.click`);

    // Always store the email for testing purposes
    if (!tempEmails.has(localPart)) {
      console.log(`Adding new temp email: ${localPart}`);
      tempEmails.add(localPart);
    }

    // Initialize array for this email address if it doesn't exist
    if (!emailsByAddress[localPart]) {
      emailsByAddress[localPart] = [];
    }
    
    // Better handle email content
    let emailText = text || '';
    let emailHtml = html || '';
    
    // If content couldn't be extracted, try to get it from headers
    if (emailText === 'Error: Could not extract email content' || !emailText.trim()) {
      if (headers && typeof headers === 'object') {
        // Try to extract from headers
        const rawContent = headers['content-transfer-encoding'] || headers['content'] || '';
        if (rawContent) {
          emailText = `Original email content is encoded. Please check the original email.`;
        }
      }
    }
    
    // Format the email data for storage
    const emailData = {
      from: from,
      to: toAddress,
      subject: subject || 'No Subject',
      text: emailText,
      html: emailHtml,
      receivedAt: new Date(),
      headers: headers || {}
    };
    
    // Store the email
    emailsByAddress[localPart].push(emailData);
    console.log(`Email stored for ${localPart}. Total emails: ${emailsByAddress[localPart].length}`);

    // Save to Redis
    await saveEmailsToRedis(localPart, emailsByAddress[localPart]);

    // Return success
    return res.status(200).send('Email stored successfully');
  } catch (error) {
    console.error('Error processing email:', error);
    return res.status(500).send(`Server error: ${error.message}`);
  }
});

// Get emails for a temp email
app.get('/api/emails/:localPart', async (req, res) => {
  const { localPart } = req.params;
  
  // If not in memory, try to get from Redis
  if (!emailsByAddress[localPart] && redisClient.isReady) {
    try {
      const emails = await redisClient.get(`email:${localPart}`);
      if (emails) {
        emailsByAddress[localPart] = JSON.parse(emails);
        tempEmails.add(localPart);
      }
    } catch (err) {
      console.error(`Error getting emails for ${localPart} from Redis:`, err);
    }
  }
  
  res.json(emailsByAddress[localPart] || []);
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  if (redisClient.isReady) {
    await redisClient.quit();
  }
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`http://localhost:${PORT}`);
}); 