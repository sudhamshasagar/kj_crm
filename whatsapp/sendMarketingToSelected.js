const axios = require("axios");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const WHATSAPP_TOKEN = defineSecret("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_ID = defineSecret("WHATSAPP_PHONE_ID");

exports.sendMarketingToSelected = onCall(
{
  region: "asia-south1",
  secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_ID]
},
async (request) => {

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login required");
  }

  const { numbers } = request.data;

  if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
    throw new HttpsError("invalid-argument", "Numbers array required");
  }

  const token = WHATSAPP_TOKEN.value();
  const phoneId = WHATSAPP_PHONE_ID.value();

  let sent = 0;
  let failed = 0;

  for (const mobile of numbers) {

    try {

      await axios.post(
        `https://graph.facebook.com/v22.0/${phoneId}/messages`,
        {
          messaging_product: "whatsapp",
          to: `91${mobile}`,
          type: "template",
          template: {
            name: "ram_navami_template_2",
            language: { code: "kn" }
          }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      sent++;

      await new Promise(r => setTimeout(r, 80));

    } catch (err) {

      console.error("Failed:", mobile);
      failed++;

    }

  }

  return {
    success: true,
    total: numbers.length,
    sent,
    failed
  };

});