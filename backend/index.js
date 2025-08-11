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
  const { to, from, subject, text, html } = req.body;
  // Extract local part from 'to' field
  const toAddress = Array.isArray(to) ? to[0].address : to;
  const localPart = toAddress.split('@')[0];

  if (!tempEmails.has(localPart)) {
    // Ignore emails sent to unknown temp emails
    return res.status(400).send('Unknown temp email');
  }

  if (!emailsByAddress[localPart]) emailsByAddress[localPart] = [];
  emailsByAddress[localPart].push({ from, subject, text, html, receivedAt: new Date() });

  res.send('Email stored');
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