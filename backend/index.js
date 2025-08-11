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
  console.log('Received email:', JSON.stringify(req.body, null, 2));
  
  const { to, from, subject, text, html } = req.body;
  
  // Extract local part from 'to' field
  let localPart;
  let toAddress;
  
  if (typeof to === 'string') {
    toAddress = to;
    localPart = to.split('@')[0];
  } else if (Array.isArray(to)) {
    toAddress = to[0].address;
    localPart = toAddress.split('@')[0];
  } else if (to && to.address) {
    // Handle the case where 'to' is an object with 'address' property
    toAddress = to.address;
    localPart = toAddress.split('@')[0];
  } else {
    console.error('Invalid or missing "to" field in email:', to);
    return res.status(400).send('Invalid email format: missing or invalid "to" field');
  }

  console.log(`Processing email for: ${localPart}@zhongkai.click`);

  if (!tempEmails.has(localPart)) {
    // For debugging, let's still store unknown emails temporarily
    console.log(`Unknown temp email: ${localPart}, but storing anyway for testing`);
    tempEmails.add(localPart); // Add it for testing purposes
    // Uncomment to reject unknown emails in production
    // return res.status(400).send('Unknown temp email');
  }

  if (!emailsByAddress[localPart]) emailsByAddress[localPart] = [];
  
  // Format the email data for storage
  const emailData = {
    from: from,
    subject: subject || 'No Subject',
    text: text || '',
    html: html || '',
    receivedAt: new Date()
  };
  
  emailsByAddress[localPart].push(emailData);
  console.log(`Email stored for ${localPart}. Total emails: ${emailsByAddress[localPart].length}`);

  res.status(200).send('Email stored');
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