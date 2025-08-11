/**
 * Cloudflare Email Worker for TempMail Service
 * This worker receives emails from Cloudflare Email Routing and forwards them to your backend API
 */

// Configure your backend API endpoint here
const BACKEND_URL = "https://mail.zhongkai.click/api/email-inbound";

async function handleEmail(message) {
  // Extract email data
  const rawFrom = message.from;
  const rawTo = message.to;
  const rawSubject = message.headers.get("subject") || "";
  
  // Parse the content based on the content type
  let emailContent = "";
  let htmlContent = "";
  
  // Check if the email is multipart
  const contentType = message.headers.get("content-type") || "";
  if (contentType.includes("multipart/")) {
    try {
      // Handle multipart emails
      const parts = await message.raw.multipart();
      for (const part of parts) {
        const partContentType = part.headers.get("content-type") || "";
        if (partContentType.includes("text/plain")) {
          emailContent = await part.text();
        } else if (partContentType.includes("text/html")) {
          htmlContent = await part.text();
        }
      }
    } catch (error) {
      console.error("Error processing multipart email:", error);
      emailContent = await message.text();
    }
  } else {
    // Handle plain text emails
    emailContent = await message.text();
  }

  // Parse email addresses
  const from = parseEmailAddress(rawFrom);
  const to = parseEmailAddress(rawTo);

  // Prepare the payload for your backend
  const payload = {
    from: from,
    to: to,
    subject: rawSubject,
    text: emailContent,
    html: htmlContent || null,
    receivedAt: new Date().toISOString(),
    headers: Object.fromEntries(message.headers.entries())
  };

  console.log("Forwarding email:", JSON.stringify({
    from: from,
    to: to,
    subject: rawSubject
  }));

  try {
    // Send the email data to your backend API
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Cloudflare-Worker-Email-Handler",
        "X-Email-Forwarded-By": "Cloudflare-Worker"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend API returned ${response.status}: ${errorText}`);
    }

    console.log("Email successfully forwarded to backend");
    return new Response("Email processed", { status: 200 });
  } catch (error) {
    console.error("Failed to forward email:", error);
    return new Response(`Failed to process email: ${error.message}`, { status: 500 });
  }
}

// Helper function to parse email addresses
function parseEmailAddress(rawAddress) {
  if (!rawAddress) return null;
  
  // Simple regex to extract email from "Name <email@example.com>" format
  const match = rawAddress.match(/<([^>]+)>$/);
  if (match) {
    const address = match[1];
    const name = rawAddress.slice(0, match.index).trim().replace(/"/g, '');
    return { name, address };
  }
  
  // If no angle brackets, assume the whole string is an email
  return { name: "", address: rawAddress.trim() };
}

// Main entry point for the worker
export default {
  async email(message, env, ctx) {
    return await handleEmail(message);
  }
}; 