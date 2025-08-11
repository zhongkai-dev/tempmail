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
      
      // Get email content
      let text = "";
      let html = "";
      
      try {
        // Simple approach - get raw content first
        const rawContent = await message.raw.text();
        text = rawContent;
        
        // Try to get text and HTML parts if it's multipart
        const contentType = message.headers.get("content-type") || "";
        if (contentType.includes("multipart/")) {
          const parts = await message.raw.multipart();
          for (const part of parts) {
            const partContentType = part.headers.get("content-type") || "";
            if (partContentType && partContentType.includes("text/plain")) {
              text = await part.text();
            } else if (partContentType && partContentType.includes("text/html")) {
              html = await part.text();
            }
          }
        }
      } catch (error) {
        console.error("Error extracting email content:", error.message);
        // Fall back to a simple approach if multipart parsing fails
        try {
          text = await message.text();
        } catch (e) {
          console.error("Failed to get email text:", e.message);
          text = "Error: Could not extract email content";
        }
      }
      
      // Prepare simplified payload to reduce chances of errors
      const payload = {
        from: from,
        to: to,
        subject: subject,
        text: text,
        html: html || ""
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