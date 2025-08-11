/**
 * Cloudflare Email Worker for TempMail Service
 * This worker receives emails from Cloudflare Email Routing and forwards them to your backend API
 */

// Configure your backend API endpoint here
const BACKEND_URL = "https://mail.zhongkai.click/api/email-inbound";

export default {
  async email(message, env, ctx) {
    try {
      // Extract basic email data
      const from = message.from;
      const to = message.to;
      const subject = message.headers.get("subject") || "";
      
      // Extract all headers for debugging and content recovery
      const headers = {};
      for (const [key, value] of message.headers.entries()) {
        headers[key.toLowerCase()] = value;
      }
      
      // Get email content with multiple fallbacks
      let text = "";
      let html = "";
      
      try {
        // Try to get the raw email first
        const rawEmail = await message.raw.text();
        
        // Try to parse multipart content if available
        const contentType = headers["content-type"] || "";
        if (contentType.includes("multipart/")) {
          try {
            const parts = await message.raw.multipart();
            
            // Process each part
            for (const part of parts) {
              const partContentType = part.headers.get("content-type") || "";
              
              if (partContentType && partContentType.includes("text/plain")) {
                text = await part.text();
              } else if (partContentType && partContentType.includes("text/html")) {
                html = await part.text();
              }
            }
            
            // If we couldn't extract text but have HTML, create a text version
            if (!text && html) {
              text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            }
            
          } catch (multipartError) {
            console.error("Error processing multipart:", multipartError.message);
            // Fall back to the raw email if multipart parsing fails
            text = rawEmail;
          }
        } else {
          // Not multipart, use raw email content
          text = rawEmail;
        }
      } catch (contentError) {
        console.error("Error extracting content:", contentError.message);
        text = ""; // Leave text empty if there's an error
      }
      
      // Prepare payload with all available data
      const payload = {
        from: from,
        to: to,
        subject: subject,
        text: text || "",
        html: html || "",
        headers: headers,
        receivedAt: new Date().toISOString()
      };
      
      console.log("Processing email from:", from, "to:", to);
      
      // Send to backend with retries
      ctx.waitUntil(
        (async () => {
          let retries = 3;
          let success = false;
          
          while (retries > 0 && !success) {
            try {
              const response = await fetch(BACKEND_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
              });
              
              if (response.ok) {
                console.log("Email forwarded successfully");
                success = true;
              } else {
                const errorText = await response.text();
                throw new Error(`Backend returned ${response.status}: ${errorText}`);
              }
            } catch (error) {
              console.error(`Attempt failed (${retries} left):`, error.message);
              retries--;
              if (retries > 0) await new Promise(r => setTimeout(r, 1000));
            }
          }
        })()
      );

      // Acknowledge receipt immediately
      return;

    } catch (error) {
      console.error("Worker execution error:", error.message);
      // Even with errors, we must not throw, or Cloudflare will retry.
      // The email is already acknowledged by returning.
    }
  }
}; 