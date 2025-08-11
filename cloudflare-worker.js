/**
 * Cloudflare Email Worker for TempMail Service
 * This worker forwards the raw email to the backend for processing.
 */
const BACKEND_URL = "https://mail.zhongkai.click/api/email-inbound";

export default {
  async email(message, env, ctx) {
    const rawEmail = new Response(message.raw);
    const rawEmailText = await rawEmail.text();

    ctx.waitUntil(
      fetch(BACKEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "X-Email-From": message.from,
          "X-Email-To": message.to
        },
        body: rawEmailText,
      })
      .then(response => {
        if (!response.ok) {
          console.error(`Backend failed to process email: ${response.status}`);
        } else {
          console.log(`Successfully forwarded raw email to backend.`);
        }
      })
      .catch(err => {
        console.error(`Fetch to backend failed:`, err);
      })
    );
    await message.forward(message.to);
  }
}; 