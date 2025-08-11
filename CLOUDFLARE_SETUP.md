# Cloudflare Email Routing Setup for TempMail

This guide explains how to set up Cloudflare Email Routing with a Worker to forward emails to your TempMail backend.

## Step 1: Create a Cloudflare Worker

1. Log in to your Cloudflare dashboard
2. Select your domain (`zhongkai.click`)
3. Click on **Workers & Pages** in the sidebar
4. Click **Create application**
5. Select **Create Worker**
6. Give your worker a name (e.g., `tempmail`)
7. Delete the default code and paste the contents of the `cloudflare-worker.js` file
8. Update the `BACKEND_URL` constant if your backend URL is different
9. Click **Deploy**

## Step 2: Configure Email Routing

1. Go back to your Cloudflare dashboard
2. Select your domain (`zhongkai.click`)
3. Click on **Email** in the sidebar
4. Click on **Email Routing**
5. If not already enabled, click **Enable Email Routing**
6. In the **Catch-all address** section, click **Create catch-all**
7. Select **Send to a Worker** as the action
8. Select your newly created worker (e.g., `tempmail`)
9. Click **Create**

## Step 3: Verify Your Configuration

1. Make sure your domain's MX records are correctly set up (Cloudflare should handle this automatically)
2. Send a test email to any address at your domain (e.g., `test@zhongkai.click`)
3. Check the Cloudflare Worker logs to see if the email was received and processed
4. Verify that the email appears in your TempMail frontend

## Troubleshooting

If emails are being dropped:

1. **Check Worker Logs**: 
   - Go to your Cloudflare dashboard → Workers & Pages → Your Worker → Logs
   - Look for any errors in the logs

2. **Verify Worker Execution**:
   - Make sure the worker is being triggered when emails arrive
   - Check that the `email` handler is properly defined

3. **Check Backend Connectivity**:
   - Ensure your backend URL is correct and accessible from Cloudflare
   - Verify that your backend is properly handling the POST requests

4. **Email Routing Status**:
   - Check the Email Routing logs in Cloudflare dashboard
   - Make sure the status is "Forwarded" rather than "Dropped"

5. **CORS Issues**:
   - If your backend is rejecting the requests, check for CORS configuration
   - Make sure your backend accepts requests from Cloudflare Workers

## Common Issues

- **"Dropped" Status**: This usually means the worker is not properly configured or has an error
- **Backend Not Receiving Data**: Check the format of the data being sent to match what your backend expects
- **Worker Errors**: Look for syntax errors or runtime errors in your worker code 