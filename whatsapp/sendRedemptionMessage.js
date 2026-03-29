const axios = require("axios");
const { defineSecret } = require("firebase-functions/params");

/* ================================
   WhatsApp Secrets
================================ */

const WHATSAPP_TOKEN = defineSecret("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_ID = defineSecret("WHATSAPP_PHONE_ID");

/* ================================
   Send WhatsApp Message
================================ */

async function sendWhatsApp({
  customerName,
  customerMobile,
  amount,
  consentLink
}) {
  try {

    const token = WHATSAPP_TOKEN.value();
    const phoneId = WHATSAPP_PHONE_ID.value();

    const url = `https://graph.facebook.com/v22.0/${phoneId}/messages`;

    const response = await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to: `91${customerMobile}`,
        type: "template",
        template: {
          name: "investment_redemption",
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: customerName },
                { type: "text", text: amount.toString() },
                { type: "text", text: consentLink }
              ]
            }
          ]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("WhatsApp message sent:", response.data);

    return response.data;

  } catch (error) {

    console.error(
      "WhatsApp API Error:",
      error.response?.data || error.message
    );

    throw new Error(
      error.response?.data?.error?.message ||
      "WhatsApp send failed"
    );
  }
}

async function sendKarigarOrderWhatsApp({
  karigarName,
  karigarMobile,
  orderId,
  items
}) {
  try {

    const token = WHATSAPP_TOKEN.value();
    const phoneId = WHATSAPP_PHONE_ID.value();

    const formattedMobile =
      karigarMobile.startsWith("91")
        ? karigarMobile
        : `91${karigarMobile}`;

    const url = `https://graph.facebook.com/v22.0/${phoneId}/messages`;

    const itemLines = items
      .map(
        (item, i) =>
          `${i + 1}. ${item.name} (${item.net}g) - Delivery: ${item.deliveryDate}`
      )
      .join("\n");

    const response = await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to: formattedMobile,
        type: "template",
        template: {
          name: "karigar_order_assignment",
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: karigarName },
                { type: "text", text: orderId },
                { type: "text", text: itemLines }
              ]
            }
          ]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("Karigar WhatsApp sent:", response.data);

    return response.data;

  } catch (error) {

    console.error(
      "Karigar WhatsApp Error:",
      error.response?.data || error.message
    );

    throw new Error("Karigar WhatsApp send failed");
  }
}

module.exports = {
  sendWhatsApp,
  sendKarigarOrderWhatsApp,
  WHATSAPP_TOKEN,
  WHATSAPP_PHONE_ID
};