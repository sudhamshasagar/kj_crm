const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

const db = admin.firestore();

const {
  sendWhatsApp,
  WHATSAPP_TOKEN,
  WHATSAPP_PHONE_ID
} = require("../whatsapp/sendRedemptionMessage");

/* =====================================================
   UTILITIES
===================================================== */

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function normalizeMobile(m) {
  return String(m).replace(/\D/g, "").slice(-10);
}

/* =====================================================
   CREATE REDEMPTION REQUEST
===================================================== */

exports.createRedemptionRequest = onCall(
  {
    region: "asia-south1",
    secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_ID]
  },
  async (request) => {

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required");
    }

    try {

      const {
        estimationId,
        investmentId,
        customerName,
        customerMobile,
        amount
      } = request.data;

      if (!estimationId || !investmentId || !customerMobile || !amount) {
        throw new HttpsError("invalid-argument", "Missing fields");
      }

      /* ===== Generate secure token ===== */

      const rawToken = generateToken();
      const tokenHash = hashToken(rawToken);

      const expiry = admin.firestore.Timestamp.fromMillis(Date.now() + (10 * 60 * 1000));

      /* ===== Save Firestore request ===== */

      const docRef = await db.collection(
        "INVESTMENT_REDEMPTION_REQUESTS"
      ).add({

        estimationId,
        investmentId,

        customerName,
        customerMobile,

        amount,

        status: "PENDING",

        consentTokenHash: tokenHash,
        tokenExpiry: expiry,

        createdBy: {
          uid: request.auth.uid,
          email: request.auth.token.email || null
        },

        createdAt:
          admin.firestore.FieldValue.serverTimestamp()
      });

      const requestId = docRef.id;

      /* ===== Consent link ===== */

      const consentLink =
        `https://keshava-crm.web.app/redeem-consent/${requestId}/${rawToken}`;

      /* ===== Send WhatsApp message ===== */

      await sendWhatsApp({
        customerName,
        customerMobile,
        amount,
        consentLink
      });

      logger.info("Redemption request created", { requestId });

      return {
        success: true,
        requestId
      };

    } catch (err) {

      logger.error("Create redemption request failed", err);

      throw new HttpsError("internal", err.message);
    }
  }
);

/* =====================================================
   APPROVE / REJECT REDEMPTION
===================================================== */

exports.approveRedemptionConsent = onCall(
  { region: "asia-south1" },
  async (request) => {

    try {

      const {
        requestId,
        token,
        mobile,
        action
      } = request.data;

      if (!requestId || !token || !mobile || !action) {
        throw new HttpsError("invalid-argument", "Missing fields");
      }

      if (!["APPROVED", "REJECTED"].includes(action)) {
        throw new HttpsError("invalid-argument", "Invalid action");
      }

      const docRef =
        db.collection("INVESTMENT_REDEMPTION_REQUESTS").doc(requestId);

      const snap = await docRef.get();

      if (!snap.exists) {
        throw new HttpsError("not-found", "Request not found");
      }

      const old = snap.data();

      if (!["PENDING", "OPENED"].includes(old.status)) {
        throw new HttpsError("failed-precondition", "Already processed");
      }

      const incomingHash = hashToken(token);

      if (incomingHash !== old.consentTokenHash) {
        throw new HttpsError("permission-denied", "Invalid token");
      }

      if (Date.now() > old.tokenExpiry.toMillis()) {
        throw new HttpsError("deadline-exceeded", "Link expired");
      }

      if (
        normalizeMobile(mobile) !==
        normalizeMobile(old.customerMobile)
      ) {
        throw new HttpsError("permission-denied", "Mobile mismatch");
      }

      const ip =
        request.rawRequest.headers["x-forwarded-for"] ||
        request.rawRequest.ip ||
        "unknown";

      const userAgent =
        request.rawRequest.headers["user-agent"] || "unknown";

      await docRef.update({

        status: action,

        approvedAt:
          admin.firestore.FieldValue.serverTimestamp(),

        consentTokenHash: null,
        tokenExpiry: null,

        audit: {
          ip,
          userAgent,
          verifiedMobile: mobile
        }

      });

      logger.info("Redemption consent processed", {
        requestId,
        action
      });

      return {
        success: true,
        action
      };

    } catch (err) {

      logger.error("Consent approval failed", err);

      throw new HttpsError("internal", err.message);
    }
  }
);