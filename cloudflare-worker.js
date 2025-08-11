/**
 * Cloudflare Email Worker for TempMail Service
 * Handles receiving emails and forwarding them to a backend.
 */
const BACKEND_URL = "https://mail.zhongkai.click/api/email-inbound";

export default {
  async email(message, env, ctx) {
    try {
      const from = message.from;
      const to = message.to;
      const subject = message.headers.get("subject") || "";
      const headers = Object.fromEntries(message.headers);
      const contentType = headers["content-type"] || "";

      let text = "";
      let html = "";

      if (contentType.includes("multipart/")) {
        try {
          const parts = await message.raw.multipart();
          for (const part of parts) {
            const partContentType = part.headers.get("content-type") || "";
            if (partContentType.includes("text/plain")) {
              text = await part.text();
            } else if (partContentType.includes("text/html")) {
              html = await part.text();
            }
          }
        } catch (e) {
          console.error("Failed to parse multipart email, falling back to raw text.", e);
          try {
            text = await message.raw.text();
          } catch (rawErr) {
            console.error("Failed to read raw text after multipart failure.", rawErr);
            text = "Could not parse email body.";
          }
        }
      } else {
        // Not a multipart email, so just read the body.
        text = await message.text();
      }

      const payload = { from, to, subject, text, html, headers, receivedAt: new Date().toISOString() };
      
      // Fire-and-forget the request to the backend.
      // This ensures we don't hold up the email delivery pipeline.
      ctx.waitUntil(
        fetch(BACKEND_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).then(response => {
            if(!response.ok){
                return response.text().then(errorText => {
                    console.error(`Backend failed to store email: ${response.status}`, errorText);
                });
            }
            console.log(`Successfully forwarded email to backend.`);
        }).catch(err => {
            console.error(`Fetch to backend failed:`, err);
        })
      );
      
      // Acknowledge the email to prevent retries.
      await message.forward(to); // Forward to a blackhole address to satisfy the protocol
    } catch (error) {
      console.error("A top-level error occurred in the email worker:", error.message);
      // Even in case of error, we must "succeed" to prevent Cloudflare from retrying.
      // The error is logged for debugging.
      await message.forward(to); // Blackhole it
    }
  }
}; 