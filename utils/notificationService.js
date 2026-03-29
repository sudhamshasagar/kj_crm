// -----------------------------------------------------------
// NOTIFICATION SERVICE MODULE
// Handles:
// 1. In-App Notifications (per customer)
// 2. WhatsApp Notifications (Meta Cloud API - placeholder)
// 3. Broadcast notifications on new scheme creation
// -----------------------------------------------------------

import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";

import { db } from "../firebaseConfig";
import { CUSTOMERS_COLLECTION } from "./investmentService";

// Root collection for notifications
export const NOTIFICATIONS_COLLECTION = "NOTIFICATIONS";


// -----------------------------------------------------------
// 1. SEND IN-APP NOTIFICATION TO ONE CUSTOMER
// -----------------------------------------------------------
export async function sendInAppNotification(customerId, { title, message, schemeId }) {
  const ref = collection(
    db,
    `${NOTIFICATIONS_COLLECTION}/${customerId}/USER_NOTIFICATIONS`
  );

  const payload = {
    title,
    message,
    schemeId: schemeId || null,
    timestamp: serverTimestamp(),
    unread: true,
    type: "NEW_SCHEME",
  };

  await addDoc(ref, payload);

  return { success: true };
}


// -----------------------------------------------------------
// 2. WHATSAPP NOTIFICATION (META API PLACEHOLDER)
// -----------------------------------------------------------
export async function sendWhatsAppNotification(mobile, { schemeName, monthlyAmount }) {
  // Replace these later with your real values
  const WHATSAPP_ACCESS_TOKEN = "YOUR_META_ACCESS_TOKEN";
  const WHATSAPP_PHONE_NUMBER_ID = "YOUR_WHATSAPP_NUMBER_ID";

  const url = `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: mobile,
    type: "template",
    template: {
      name: "scheme_launch", // you will create this template inside Meta
      language: { code: "en_US" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: schemeName },
            { type: "text", text: String(monthlyAmount) },
          ],
        },
      ],
    },
  };

  // WhatsApp disabled until keys are added
  if (WHATSAPP_ACCESS_TOKEN === "YOUR_META_ACCESS_TOKEN") {
    console.warn("WhatsApp API key missing — skipping WhatsApp send.");
    return;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("WhatsApp sent:", data);
    return data;
  } catch (err) {
    console.error("WhatsApp send failed:", err);
    return null;
  }
}


// -----------------------------------------------------------
// 3. BROADCAST NOTIFICATION TO ALL CUSTOMERS
// -----------------------------------------------------------
export async function broadcastNewSchemeNotification({
  schemeId,
  schemeName,
  monthlyAmount,
}) {
  // Step 1: Fetch all customers
  const snap = await getDocs(CUSTOMERS_COLLECTION);

  const allCustomers = snap.docs.map(doc => ({
    customerId: doc.data().customerId,
    mobile: doc.data().mobile,
    name: doc.data().name,
  }));

  // Step 2: Send notifications one-by-one
  for (const customer of allCustomers) {
    const { customerId, mobile } = customer;

    // Send In-App Notification
    await sendInAppNotification(customerId, {
      title: "New Investment Scheme Launched",
      message: `${schemeName} is now available. Monthly deposit ₹${monthlyAmount}.`,
      schemeId,
    });

    // Send WhatsApp Message
    await sendWhatsAppNotification(mobile, {
      schemeName,
      monthlyAmount,
    });
  }

  return { success: true, total: allCustomers.length };
}

