# Temporary Email Service

A simple temporary email service that allows users to generate disposable email addresses and view incoming emails.

## Features

- Generate temporary email addresses
- Receive and display incoming emails
- Copy email address to clipboard
- Real-time email updates (polling every 5 seconds)

## Project Structure

```
tempmail/
├── backend/         # Node.js Express server
│   ├── index.js     # Server code
│   └── package.json # Backend dependencies
├── frontend/        # Frontend files
│   ├── index.html   # HTML structure
│   ├── styles.css   # CSS styles
│   └── app.js       # Frontend JavaScript
└── README.md        # This file
```

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. Clone the repository or download the files
2. Install backend dependencies:

```
cd backend
npm install
```

### Running the Application

1. Start the backend server:

```
cd backend
npm start
```

2. Open your browser and navigate to `http://localhost:3000`

## How It Works

1. Click "Generate Temp Email" to create a temporary email address
2. The generated email will be displayed and can be copied to clipboard
3. Any emails sent to this address will appear in the inbox below
4. The inbox automatically refreshes every 5 seconds

## Cloudflare Worker Integration

To receive actual emails, you need to set up a Cloudflare Worker that forwards incoming emails to your `/api/email-inbound` endpoint. The worker should:

1. Process incoming emails from Cloudflare Email Routing
2. Format the email data (to, from, subject, text/html content)
3. Forward the data to your backend endpoint

## Security Considerations

This is a basic implementation and should not be used in production without additional security measures:

- Add rate limiting to prevent abuse
- Implement authentication for accessing emails
- Use a database instead of in-memory storage
- Add HTTPS for secure communication
- Sanitize HTML content in emails to prevent XSS attacks 