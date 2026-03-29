const axios = require("axios");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

/* ================================
   WhatsApp Secrets
================================ */

const WHATSAPP_TOKEN = defineSecret("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_ID = defineSecret("WHATSAPP_PHONE_ID");

/* ================================
   Account Opening WhatsApp
================================ */

exports.sendAccountOpeningWhatsApp = onCall(
  {
    region: "asia-south1",
    secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_ID]
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required");
    }

    const {
      mobile,
      customerName,
      accountNumber,
      schemeName,
      openingAmount,
      date,
      balance
    } = request.data;

    try {
      const token = WHATSAPP_TOKEN.value();
      const phoneId = WHATSAPP_PHONE_ID.value();

      const url = `https://graph.facebook.com/v22.0/${phoneId}/messages`;

      const payload = {
        messaging_product: "whatsapp",
        to: `91${mobile}`,
        type: "template",
        template: {
          name: "investment_account_opened",
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: customerName },
                { type: "text", text: String(openingAmount) },
                { type: "text", text: accountNumber || "-" },
                { type: "text", text: schemeName || "-" },
                { type: "text", text: date || "-" },
                { type: "text", text: String(balance || "-") }
              ]
            }
          ]
        }
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      console.log("Account opening WhatsApp sent:", response.data);

      return response.data;

    } catch (error) {
      console.error(
        "WhatsApp API Error:",
        error.response?.data || error.message
      );

      throw new HttpsError(
        "internal",
        error.response?.data?.error?.message || "WhatsApp send failed"
      );
    }
  }
);