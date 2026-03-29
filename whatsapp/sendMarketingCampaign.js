const axios = require("axios");
const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const WHATSAPP_TOKEN = defineSecret("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_ID = defineSecret("WHATSAPP_PHONE_ID");

exports.sendMarketingCampaign = onCall(
{
  region: "asia-south1",
  timeoutSeconds: 540,
  secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_ID]
},
async (request) => {

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login required");
  }

  const db = admin.firestore();

  const token = WHATSAPP_TOKEN.value();
  const phoneId = WHATSAPP_PHONE_ID.value();

  const campaignId = "ramNavami2026";

  // 🔹 fetch only unsent customers
  const customersSnap = await db
    .collection("CUSTOMERS")
    .where(`marketing.${campaignId}`, "!=", true)
    .limit(100)
    .get();

  if (customersSnap.empty) {
    return {
      success: true,
      message: "Campaign completed"
    };
  }

  let sent = 0;
  let failed = 0;

  for (const doc of customersSnap.docs) {

    const data = doc.data();
    const mobile = data.mobile;

    if (!mobile) {
      failed++;
      continue;
    }

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

      // mark customer as sent
      await doc.ref.set({
        marketing: {
          [campaignId]: true
        }
      }, { merge: true });

      await new Promise(r => setTimeout(r, 80));

    } catch (err) {

      console.error("Failed:", mobile);
      failed++;

    }

  }

  return {
    success: true,
    sent,
    failed,
    processed: customersSnap.size
  };

});