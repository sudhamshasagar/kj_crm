const axios = require("axios");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const WHATSAPP_TOKEN = defineSecret("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_ID = defineSecret("WHATSAPP_PHONE_ID");

exports.sendInvestmentReceiptWhatsApp = onCall(
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
    transactionId,
    accountNumber,
    schemeName,
    installmentMonth,
    paymentMode,
    amountPaid,
    totalInvested,
    receiptUrl
  } = request.data;

  try {

    const token = WHATSAPP_TOKEN.value();
    const phoneId = WHATSAPP_PHONE_ID.value();

    const response = await axios.post(
      `https://graph.facebook.com/v22.0/${phoneId}/messages`,
      {
        messaging_product: "whatsapp",
        to: `91${mobile}`,
        type: "template",
        template: {
          name: "investment_payment_receipt",
          language: { code: "en" },
          components: [
            {
              type: "header",
              parameters: [
                {
                  type: "document",
                  document: {
                    link: receiptUrl,
                    filename: "Investment_Receipt.pdf"
                  }
                }
              ]
            },
            {
              type: "body",
              parameters: [
                { type: "text", text: customerName },           // {{1}}
                { type: "text", text: transactionId },          // {{2}}
                { type: "text", text: accountNumber || "-" },   // {{3}}
                { type: "text", text: schemeName || "-" },      // {{4}}
                { type: "text", text: installmentMonth || "-" },// {{5}}
                { type: "text", text: paymentMode || "-" },     // {{6}}
                { type: "text", text: String(amountPaid) },     // {{7}}
                { type: "text", text: String(totalInvested) }   // {{8}}
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