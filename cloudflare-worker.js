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
        
        // Store raw content in a variable for debugging
        const rawContent = rawEmail.substring(0, 10000); // Limit size
        
        // Try to parse multipart content if available
        const contentType = message.headers.get("content-type") || "";
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
              // Simple HTML to text conversion
              const tempText = html.replace(/<[^>]*>/g, ' ')
                                  .replace(/\s+/g, ' ')
                                  .trim();
              text = tempText || "HTML content available. Please view in HTML mode.";
            }
            
          } catch (multipartError) {
            console.error("Error processing multipart:", multipartError.message);
            // Fall back to the raw content
            text = rawContent || "Error extracting multipart content";
          }
        } else {
          // Not multipart, use raw content
          text = rawContent;
        }
      } catch (contentError) {
        console.error("Error extracting content:", contentError.message);
        text = "Error extracting email content. Please check headers.";
      }
      
      // Prepare payload with all available data
      const payload = {
        from: from,
        to: to,
        subject: subject,
        text: text || "Error: Could not extract email content",
        html: html || "",
        headers: headers,
        receivedAt: new Date().toISOString()
      };
      
      console.log("Processing email from:", from, "to:", to);
      
      // Send to backend with retries
      let retries = 3;
      let success = false;
      let lastError = null;
      
      while (retries > 0 && !success) {
        try {
          const response = await fetch(BACKEND_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          });
          
          if (response.ok) {
            console.log("Email forwarded successfully");
            success = true;
            break;
          } else {
            const errorText = await response.text();
            throw new Error(`Backend returned ${response.status}: ${errorText}`);
          }
        } catch (error) {
          lastError = error;
          console.error(`Attempt failed (${retries} left):`, error.message);
          retries--;
          // Wait a bit before retrying
          if (retries > 0) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
      
      if (success) {
        return new Response("Email processed successfully", { status: 200 });
      } else {
        console.error("All attempts failed:", lastError?.message);
        return new Response("Failed to process email after multiple attempts", { status: 500 });
      }
    } catch (error) {
      console.error("Worker execution error:", error.message);
      return new Response(`Worker error: ${error.message}`, { status: 500 });
    }
  }
}; 