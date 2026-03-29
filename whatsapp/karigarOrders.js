const { onCall } = require("firebase-functions/v2/https");
const { sendKarigarOrderWhatsApp, WHATSAPP_TOKEN, WHATSAPP_PHONE_ID } = require("./sendRedemptionMessage");

exports.sendKarigarOrder = onCall(
  { region: "asia-south1", secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_ID] },
  async (request) => {

    const { orderId, karigars } = request.data;

    if (!orderId || !karigars) {
      throw new Error("Invalid request");
    }

    for (const k of karigars) {

      const items = k.items.map(item => ({
        name: item.display || item.item,
        gross: item.gross,
        net: item.netWeight,
        stone: item.stoneWeight || 0,
        deliveryDate: item.deliveryDate
      }));

      await sendKarigarOrderWhatsApp({
        karigarName: k.name,
        karigarMobile: k.mobile,
        orderId,
        items
      });

    }

    return { success: true };
  }
);