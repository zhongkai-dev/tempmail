const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// In-memory storage (replace with DB for production)
const tempEmails = new Set();
const emailsByAddress = {};

// Generate a new temp email
app.post('/api/generate', (req, res) => {
  const localPart = crypto.randomBytes(5).toString('hex'); // e.g. 'a1b2c3d4e5'
  tempEmails.add(localPart);
  res.json({ email: `${localPart}@zhongkai.click` });
});

// Receive email from Cloudflare Worker
app.post('/api/email-inbound', (req, res) => {
  try {
    console.log('Received email request');
    
    // Check if the request body exists
    if (!req.body) {
      console.error('Empty request body');
      return res.status(400).send('Empty request body');
    }
    
    console.log('Email data:', JSON.stringify(req.body, null, 2));
    
    const { to, from, subject, text, html } = req.body;
    
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
    
    // Format the email data for storage
    const emailData = {
      from: from,
      subject: subject || 'No Subject',
      text: text || '',
      html: html || '',
      receivedAt: new Date()
    };
    
    // Store the email
    emailsByAddress[localPart].push(emailData);
    console.log(`Email stored for ${localPart}. Total emails: ${emailsByAddress[localPart].length}`);

    // Return success
    return res.status(200).send('Email stored successfully');
  } catch (error) {
    console.error('Error processing email:', error);
    return res.status(500).send(`Server error: ${error.message}`);
  }
});

// Get emails for a temp email
app.get('/api/emails/:localPart', (req, res) => {
  const { localPart } = req.params;
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`http://localhost:${PORT}`);
}); 