const { onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");
const { sendAccountOpeningWhatsApp } = require("./whatsapp/sendAccountOpening");
const { sendInvestmentReceiptWhatsApp } = require("./whatsapp/sendInvestmentWhatsapp");

admin.initializeApp();
const db = admin.firestore();

/**
 * Secure Redemption Consent Approval
 *
 * Only callable from client after mobile verification.
 * Server validates everything again before writing.
 */

exports.calculateEstimation = onCall({ region: "asia-south1" },async (request) => {
  try {
    const {
      rate,
      netWeight,
      stoneCharges,
      makingChargeValue,
      makingChargeType,
    } = request.data || {};

    const r = Number(rate) || 0;
    const net = Number(netWeight) || 0;
    const stone = Number(stoneCharges) || 0;
    const mc = Number(makingChargeValue) || 0;
    const type = makingChargeType || "PERCENT";

    // --- Chargeable weight ---
    let chargeableWeight = net;

    if (type === "GRAM") {
      chargeableWeight += mc;
    }

    // --- Gold value ---
    let goldValue = chargeableWeight * r;

    // --- Percent MC ---
    if (type === "PERCENT") {
      goldValue += goldValue * (mc / 100);
    }

    const subtotal = goldValue + stone;

    // --- GST 3% ---
    let total = subtotal * 1.03;

    // --- Round UP to nearest 10 ---
    total = Math.ceil(total / 10) * 10;

    logger.info("Estimation calculated", {
      rate: r,
      net,
      stone,
      mc,
      type,
      total,
    });

    return {
      success: true,
      netWeight: net,
      chargeableWeight,
      goldValue: Number(goldValue.toFixed(2)),
      stoneCharges: stone,
      subtotal: Number(subtotal.toFixed(2)),
      gst: Number((total - subtotal).toFixed(2)),
      total,
    };
  } catch (err) {
    logger.error("Estimation calculation failed", err);
    throw new Error("Calculation failed");
  }
});

exports.secureSaveEstimation = onCall({ region: "asia-south1" },async (request) => {
  if (!request.auth) {
    throw new Error("Authentication required");
  }

  try {
    const { customer, items, draftEstimationId, estimationType } = request.data || {};

    if (!customer || !items?.length || !draftEstimationId) {
      throw new Error("Customer, items and draftEstimationId are required.");
    }

    const num = (v) => Number(v) || 0;

    /* ===============================
       0️⃣ IDEMPOTENCY CHECK
    =============================== */
    const checkCollection =
      estimationType === "CUSTOM_ORDER"
        ? "orders"
        : "sales_estimations";

    const existingSnap = await db
      .collection(checkCollection)
      .where("draftEstimationId", "==", draftEstimationId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const existing = existingSnap.docs[0].data();

      return {
        success: true,
        estimationId: existing.estimationId,
        totalAmount: existing.summary?.totalAmount || 0,
        duplicate: true,
      };
    }

    /* ===============================
       1️⃣ FIND OR CREATE CUSTOMER
    =============================== */
    let customerId = customer.id;

    if (!customerId) {
      const existingCust = await db
        .collection("CUSTOMERS")
        .where("mobile", "==", customer.mobile)
        .limit(1)
        .get();

      if (!existingCust.empty) {
        customerId = existingCust.docs[0].data().customerId;
      } else {
        const counterRef = db.collection("COUNTERS").doc("CUSTOMER");

        customerId = await db.runTransaction(async (tx) => {
          const counterDoc = await tx.get(counterRef);
          const serial = (counterDoc.data()?.value || 0) + 1;

          tx.set(counterRef, { value: serial }, { merge: true });

          const generatedId =
            `${customer.name.slice(0, 2).toUpperCase()}-${String(serial).padStart(5, "0")}`;

          const custRef = db.collection("CUSTOMERS").doc();

          tx.set(custRef, {
            customerId: generatedId,
            name: customer.name,
            mobile: customer.mobile,
            city: customer.city || "",
            serial,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          return generatedId;
        });
      }
    }

    /* ===============================
       2️⃣ TRUSTED CALCULATION
    =============================== */
    const trustedItems = items.map((item) => {
      const r = num(item.rate);
      const net = num(item.netWeight);
      const stone = num(item.stoneCharges);
      const mc = num(item.makingChargeValue);

      let goldValue = 0;

      if (item.makingChargeType === "GRAM") {
        goldValue = (net + mc) * r;
      } else if (item.makingChargeType === "PERCENT") {
        const base = net * r;
        goldValue = base + base * (mc / 100);
      } else {
        goldValue = net * r;
      }

      const subtotal = goldValue + stone;
      const total = Math.ceil((subtotal * 1.03) / 10) * 10;

      return {
        ...item,
        goldValue: Number(goldValue.toFixed(2)),
        subtotal: Number(subtotal.toFixed(2)),
        total,
      };
    });

    const totalAmount = trustedItems.reduce((s, i) => s + i.total, 0);

    /* ===============================
       3️⃣ PARALLEL RESERVATION VALIDATION
    =============================== */
    /* ===============================
   3️⃣ STOCK VALIDATION + LOCK
=============================== */

if (estimationType !== "CUSTOM_ORDER") {

  await Promise.all(
    trustedItems.map(async (item) => {

      if (!item.stockItemId) {
        throw new Error("Stock item ID missing");
      }

      const ref = db.collection("stock_items").doc(item.stockItemId);
      const snap = await ref.get();

      if (!snap.exists) {
        throw new Error(`Item missing: ${item.stockItemId}`);
      }

      const data = snap.data();

      if (data.status === "SOLD") {
        throw new Error(`Item already sold`);
      }

      if (data.status === "RESERVED_QUOTATION") {
        throw new Error(`Item already locked`);
      }

      if (data.status !== "RESERVED_DRAFT") {
        throw new Error(`Reservation expired`);
      }

      if (data.reservedByEstimationId !== draftEstimationId) {
        throw new Error(`Taken by another staff`);
      }

    })
  );

  await Promise.all(
    trustedItems.map(async (item) => {

      const ref = db.collection("stock_items").doc(item.stockItemId);
      const snap = await ref.get();
      const stock = snap.data();

      await ref.update({
        status: "RESERVED_QUOTATION",
        quotationLockedAt: admin.firestore.FieldValue.serverTimestamp(),
        quotationEstimationId: draftEstimationId,
        reservedAt: null,
        reservedByEstimationId: null,
        reservedByUid: null,
      });

      await db.collection("stock_ledger").add({
        stockItemId: ref.id,
        pieceBarcode: stock.pieceBarcode,
        metal: stock.metal,
        category: stock.category,
        purity: stock.purity,
        eventType: "RESERVED_QUOTATION",
        referenceType: "ESTIMATION",
        referenceId: draftEstimationId,
        previousStatus: "RESERVED_DRAFT",
        newStatus: "RESERVED_QUOTATION",
        userId: request.auth.uid,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

    })
  );

}


    /* ===============================
       4️⃣ GENERATE ESTIMATION ID
    =============================== */
    const counterRef = db.collection("COUNTERS").doc(
      estimationType === "CUSTOM_ORDER" ? "CUSTOM_ORDER" : "ESTIMATION"
    );

    const estimationId = await db.runTransaction(async (tx) => {
      const doc = await tx.get(counterRef);
      
      // Ensure we are working with a Number
      let currentSerial = 0;
      if (doc.exists && typeof doc.data().value === 'number') {
        currentSerial = doc.data().value;
      }
      
      const nextSerial = currentSerial + 1;

      // Save the new mathematical number back to Firestore
      tx.set(counterRef, { value: nextSerial }, { merge: true });

      const prefix = estimationType === "CUSTOM_ORDER" ? "KJCO" : "KJDC";
      
      // Format to 3 digits (e.g., 1 -> 001, 10 -> 010, 100 -> 100)
      return `${prefix}${String(nextSerial).padStart(3, "0")}`;
    });

    /* ===============================
       5️⃣ SAVE ESTIMATION
    =============================== */
    const collectionName =
      estimationType === "CUSTOM_ORDER"
        ? "orders"
        : "sales_estimations";

    await db.collection(collectionName).add({
      draftEstimationId,
      estimationId,
      type: estimationType || "DIRECT_SALE",

      customer: {
        id: customerId,
        name: customer.name,
        mobile: customer.mobile,
        city: customer.city || "",
      },

      items: trustedItems,

      summary: {
        itemCount: trustedItems.length,
        totalAmount,
      },

      status: "OPEN",

      isDeleted: false,
      isLogVisible: true,   // ✅ ADD THIS

      createdBy: {
        uid: request.auth.uid,
        email: request.auth.token.email || null,
        name: request.auth.token.name || null,
      },

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      sortAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("draft_estimations")
            .doc(draftEstimationId)
            .delete();

    return { success: true, estimationId, totalAmount };
  } catch (err) {
    logger.error("secureSaveEstimation failed", err);
    throw new Error(err.message || "Secure save failed");
  }
});


exports.reserveItem = onCall({ region: "asia-south1" }, async (request) => {
  if (!request.auth) {
    throw new Error("Authentication required");
  }

  const { stockItemId, estimationId } = request.data || {};

  if (!stockItemId || !estimationId) {
    throw new Error("Missing reservation fields");
  }

  const ref = db.collection("stock_items").doc(stockItemId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("Item not found");

    const item = snap.data();

    // 🚫 Already sold
    if (item.status === "SOLD") {
      throw new Error("Item already sold");
    }

    // 🚫 Locked in saved quotation
    if (item.status === "RESERVED_QUOTATION") {
      throw new Error("Item locked in quotation");
    }

    // 🔁 Already reserved as draft
    if (item.status === "RESERVED_DRAFT") {
      if (item.reservedByUid === request.auth.uid) {
        return; // allow reclaim silently
      } else {
        throw new Error("Item reserved by another staff");
      }
    }

    // ✅ Only IN_STOCK can proceed
    if (item.status !== "IN_STOCK") {
      throw new Error("Invalid item state");
    }

    // Create/update draft
    const draftRef = db.collection("draft_estimations").doc(estimationId);

    tx.set(
      draftRef,
      {
        uid: request.auth.uid,
        status: "DRAFT",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Reserve as draft
    tx.update(ref, {
      status: "RESERVED_DRAFT",
      reservedAt: admin.firestore.FieldValue.serverTimestamp(),
      reservedByEstimationId: estimationId,
      reservedByUid: request.auth.uid,
    });
  });

  return { success: true };
});

exports.releaseItem = onCall({ region: "asia-south1" }, async (request) => {
  if (!request.auth) {
    throw new Error("Authentication required");
  }

  const { stockItemId, estimationId } = request.data || {};

  if (!stockItemId || !estimationId) {
    throw new Error("Missing release fields");
  }

  const ref = db.collection("stock_items").doc(stockItemId);
  const snap = await ref.get();

  if (!snap.exists) throw new Error("Item not found");

  const data = snap.data();

  // 🚫 Only draft reservations can be released
  if (data.status !== "RESERVED_DRAFT") {
    throw new Error("Cannot release locked quotation item");
  }

  if (
    data.reservedByEstimationId !== estimationId ||
    data.reservedByUid !== request.auth.uid
  ) {
    throw new Error("Not authorized to release this item");
  }

  await ref.update({
    status: "IN_STOCK",
    reservedAt: null,
    reservedByEstimationId: null,
    reservedByUid: null,
  });

  return { success: true };
});


exports.deleteDraft = onCall({ region: "asia-south1" },async (request) => {
  if (!request.auth) throw new Error("Authentication required");

  const { draftId } = request.data;
  if (!draftId) throw new Error("Draft ID required");

  const draftRef = db.collection("draft_estimations").doc(draftId);
  const draftSnap = await draftRef.get();

  if (!draftSnap.exists) throw new Error("Draft not found");

  const draft = draftSnap.data();

  if (draft.uid !== request.auth.uid) {
    throw new Error("Not authorized to delete this draft");
  }

  const itemsSnap = await db
    .collection("stock_items")
    .where("reservedByEstimationId", "==", draftId)
    .get();

  const batch = db.batch();

  itemsSnap.docs.forEach(docSnap => {
    const data = docSnap.data();

    if (data.status === "RESERVED_DRAFT") {
      batch.update(docSnap.ref, {
        status: "IN_STOCK",
        reservedAt: null,
        reservedByEstimationId: null,
        reservedByUid: null,
      });
    }
  });

  batch.delete(draftRef);

  await batch.commit();

  return { success: true };
});

exports.secureAddStock = onCall(
  { region: "asia-south1" },
  async (request) => {

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required");
    }

    const {
      metal,
      category,
      purity,
      hsnCode,
      items
    } = request.data || {};

    if (!items || !items.length) {
      throw new HttpsError("invalid-argument", "Items required");
    }

    const createdItems = [];

    await db.runTransaction(async (tx) => {

      const categoryCodeMap = {
        Jhumki: "JK",
        Bangle: "BN",
        Ring: "RG",
        Chain: "CH",
        Necklace: "NK",
        Bracelet: "BR"
      };

      const categoryCode =
        categoryCodeMap[category] || category.slice(0, 2).toUpperCase();

      const purityCode = purity.replace(/\D/g, "");

      const counterId = `BARCODE_${categoryCode}_${purityCode}`;
      const counterRef = db.collection("COUNTERS").doc(counterId);

      /* ---------- READ COUNTER FIRST ---------- */

      const counterSnap = await tx.get(counterRef);

      let current = counterSnap.exists
        ? (counterSnap.data().value || 0)
        : 0;

      /* ---------- GENERATE ITEMS ---------- */

      for (const item of items) {

        current++;

        const formatted = String(current).padStart(3, "0");

        const pieceBarcode = `${categoryCode}-${purityCode}-${formatted}`;

        createdItems.push({
          pieceBarcode,
          grossWeight: Number(item.grossWeight),
          stoneWeight: Number(item.stoneWeight) || 0,
          netWeight: Number(item.netWeight)
        });

        const stockRef = db.collection("stock_items").doc();

        tx.set(stockRef, {
          pieceBarcode,
          metal,
          category,
          purity,
          hsnCode,
          grossWeight: Number(item.grossWeight),
          stoneWeight: Number(item.stoneWeight) || 0,
          netWeight: Number(item.netWeight),
          stoneCharge: Number(item.stoneCharge) || 0,
          makingCharge: item.makingCharge || null,
          huid: item.huid || null,
          status: "IN_STOCK",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const ledgerRef = db.collection("stock_ledger").doc();

        tx.set(ledgerRef, {
          stockItemId: stockRef.id,
          pieceBarcode,
          metal,
          category,
          purity,
          eventType: "ADDED",
          referenceType: "STOCK_ENTRY",
          referenceId: null,
          previousStatus: null,
          newStatus: "IN_STOCK",
          userId: request.auth.uid,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

      }

      /* ---------- UPDATE COUNTER ONCE ---------- */

      tx.set(counterRef, { value: current }, { merge: true });

    });

    return { success: true, items: createdItems };

  }
);

exports.secureCloseSale = onCall(
  { region: "asia-south1" },
  async (request) => {

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required");
    }

    const { estimationId } = request.data;

    if (!estimationId) {
      throw new HttpsError("invalid-argument", "Estimation ID required");
    }

    /* ---------------- FIND ESTIMATION ---------------- */

    let estimationRef;
    let estimation;

    const directRef = db.collection("sales_estimations").doc(estimationId);
    const directSnap = await directRef.get();

    if (directSnap.exists) {
      estimationRef = directRef;
      estimation = directSnap.data();
    } else {
      const estSnap = await db
        .collection("sales_estimations")
        .where("estimationId", "==", estimationId)
        .limit(1)
        .get();

      if (estSnap.empty) {
        throw new HttpsError("not-found", "Estimation not found");
      }

      const estDoc = estSnap.docs[0];
      estimationRef = estDoc.ref;
      estimation = estDoc.data();
    }

    if (estimation.status === "CLOSED") {
      return {
        success: true,
        message: "Already closed",
        invoiceNo: estimation.payment?.reference || null
      };
    }

    /* ---------------- FETCH PAYMENTS ---------------- */

    const paymentsSnap = await db
      .collection("payments")
      .where("estimationId", "==", estimation.estimationId)
      .get();

    if (paymentsSnap.empty) {
      throw new HttpsError(
        "failed-precondition",
        "No payments recorded for this sale"
      );
    }

    const paymentLedger = [];
    let totalPaid = 0;

    paymentsSnap.docs.forEach(doc => {
      const data = doc.data();
      totalPaid += Number(data.amount || 0);
      paymentLedger.push(data);
    });

    const totalAmount = Number(estimation.summary?.totalAmount || 0);

    if (totalPaid < totalAmount) {
      throw new HttpsError(
        "failed-precondition",
        `Payment incomplete. Paid ₹${totalPaid}, Required ₹${totalAmount}`
      );
    }

    /* ---------------- START TRANSACTION ---------------- */

    let invoiceNo = null;

    await db.runTransaction(async (tx) => {

      /* ---------- READ SECTION (ALL READS FIRST) ---------- */

      const freshEst = await tx.get(estimationRef);
      if (!freshEst.exists) {
        throw new HttpsError("not-found", "Estimation missing");
      }

      const estData = freshEst.data();
      if (estData.status === "CLOSED") return;

      const counterRef = db.collection("COUNTERS").doc("INVOICE");
      const counterSnap = await tx.get(counterRef);

      let invSnap = null;
      let invRef = null;

      if (estData.investmentRedemption) {
        invRef = db
          .collection("INVESTMENTS")
          .doc(estData.investmentRedemption.investmentId);

        invSnap = await tx.get(invRef);

        if (!invSnap.exists) {
          throw new HttpsError("not-found", "Investment not found");
        }
      }

      const stockItems = [];

      for (const item of estData.items) {
        const ref = db.collection("stock_items").doc(item.stockItemId);
        const snap = await tx.get(ref);

        if (!snap.exists) {
          throw new HttpsError(
            "not-found",
            `Stock ${item.stockItemId} missing`
          );
        }

        const stock = snap.data();

        if (stock.status !== "RESERVED_QUOTATION") {
          throw new HttpsError(
            "failed-precondition",
            `Stock ${item.stockItemId} not reserved`
          );
        }

        stockItems.push({ ref, stock });
      }

      /* ---------- WRITE SECTION ---------- */

      let investmentAmount = 0;

      if (invSnap) {

        const inv = invSnap.data();
        const requested = Number(estData.investmentRedemption.amount || 0);

        const balance =
          Number(inv.totalAmountPaid || 0) -
          Number(inv.redeemedAmount || 0);

        if (requested > balance) {
          throw new HttpsError(
            "failed-precondition",
            "Insufficient investment balance"
          );
        }

        investmentAmount = requested;

        tx.update(invRef, {
          redeemedAmount: Number(inv.redeemedAmount || 0) + investmentAmount,
          lastRedeemedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const ledgerRef = db.collection("INVESTMENT_TRANSACTIONS").doc();

        tx.set(ledgerRef, {
          investmentId: estData.investmentRedemption.investmentId,
          customerId: inv.customerId,
          type: "DEBIT",
          amount: investmentAmount,
          grams: 0,
          amountPaid: 0,
          mode: "REDEEM",
          reference: `REDEEM-${estimation.estimationId}`,
          date: new Date().toISOString().slice(0, 10),
          source: "DIRECT_SALE",
          referenceType: "SALE",
          referenceId: estimation.estimationId,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      for (const s of stockItems) {

        tx.update(s.ref, {
          status: "SOLD",
          soldAt: admin.firestore.FieldValue.serverTimestamp(),
          soldAgainst: estimation.estimationId,
          soldBy: request.auth.uid
        });

        const ledgerRef = db.collection("stock_ledger").doc();

        tx.set(ledgerRef, {
          stockItemId: s.ref.id,
          pieceBarcode: s.stock.pieceBarcode,
          metal: s.stock.metal,
          category: s.stock.category,
          purity: s.stock.purity,
          eventType: "SOLD",
          referenceType: "SALE",
          referenceId: estimation.estimationId,
          previousStatus: "RESERVED_QUOTATION",
          newStatus: "SOLD",
          userId: request.auth.uid,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      const serial = (counterSnap.data()?.value || 0) + 1;
      invoiceNo = `KJINV${String(serial).padStart(5, "0")}`;

      tx.set(counterRef, { value: serial }, { merge: true });

      /* ---------- GST CALCULATION ---------- */

      const items = estData.items;

      let taxable = 0;
      items.forEach(i => {
        taxable += Number(i.total || 0) / 1.03;
      });

      taxable = Math.round(taxable);

      const cgst = Math.round(taxable * 0.015);
      const sgst = Math.round(taxable * 0.015);

      const invoiceTotal = taxable + cgst + sgst;

      const adjustmentsTotal =
        Number(request.data.exchangeValue || 0) +
        Number(investmentAmount || 0) +
        Number(request.data.manualDiscount || 0);

      const grand = Math.round((invoiceTotal - adjustmentsTotal) / 10) * 10;

      /* ---------- CLOSE SALE ---------- */

      tx.update(estimationRef, {
        status: "CLOSED",
        closedAt: admin.firestore.FieldValue.serverTimestamp(),
        payment: {
          reference: invoiceNo,
          totalPaid
        },
        invoice: {
          number: invoiceNo,
          generatedAt: admin.firestore.FieldValue.serverTimestamp(),
          items,
          totals: { taxable, cgst, sgst, grand },
          paymentLedger,
          adjustments: {
            exchange: request.data.exchangeValue || 0,
            investment: investmentAmount,
            discount: request.data.manualDiscount || 0
          },
          editableUntil: Date.now() + (30 * 24 * 60 * 60 * 1000),
          locked: false
        }
      });

    });

    return {
      success: true,
      invoiceNo,
      totalPaid
    };

  }
);

exports.recordPayment = onCall(
  { region: "asia-south1" },
  async (request) => {

    try {

      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Login required");
      }

      const { estimationId, transactions } = request.data || {};

      if (!estimationId) {
        throw new HttpsError("invalid-argument", "Estimation ID required");
      }

      if (!Array.isArray(transactions) || transactions.length === 0) {
        throw new HttpsError("invalid-argument", "Transactions required");
      }

      /* ---------------- FIND ESTIMATION ---------------- */

      let estDoc;

      const directRef = db.collection("sales_estimations").doc(estimationId);
      const directSnap = await directRef.get();

      if (directSnap.exists) {
        estDoc = directSnap;
      } else {

        const snap = await db
          .collection("sales_estimations")
          .where("estimationId", "==", estimationId)
          .limit(1)
          .get();

        if (snap.empty) {
          throw new HttpsError("not-found", "Estimation not found");
        }

        estDoc = snap.docs[0];
      }

      const estData = estDoc.data();

      if (!estData?.estimationId) {
        throw new HttpsError("internal", "Invalid estimation record");
      }

      /* ---------------- RECORD PAYMENTS ---------------- */

      const batch = db.batch();

      for (const tx of transactions) {

        const amount = Number(tx.amount);

        if (!amount || amount <= 0) {
          throw new HttpsError("invalid-argument", "Invalid payment amount");
        }

        const ref = db.collection("payments").doc();

        batch.set(ref, {
          estimationId: estData.estimationId,
          amount: amount,
          method: tx.method || "CASH",
          reference: tx.reference || null,
          type: "ADVANCE",
          createdBy: request.auth.uid,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

      }

      await batch.commit();

      return { success: true };

    } catch (err) {

      console.error("recordPayment failed:", err);

      if (err instanceof HttpsError) {
        throw err;
      }

      throw new HttpsError("internal", err.message || "Payment recording failed");
    }
  }
);

exports.editInvoice = onCall(
  { region: "asia-south1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required");
    }
    const { estimationId, updates } = request.data;
    const snap = await db
      .collection("sales_estimations")
      .where("estimationId", "==", estimationId)
      .limit(1)
      .get();
    if (snap.empty) {
      throw new HttpsError("not-found", "Invoice not found");
    }
    const doc = snap.docs[0];
    const data = doc.data();
    if (!data.invoice) {
      throw new HttpsError("failed-precondition", "No invoice");
    }
    if (data.invoice.locked) {
      throw new HttpsError("permission-denied", "Invoice locked");
    }
    if (Date.now() > data.invoice.editableUntil) {
      throw new HttpsError("permission-denied", "Edit window expired");
    }
    await db.collection("invoice_edits").add({
      estimationId,
      invoiceNo: data.invoice.number,
      editedBy: request.auth.uid,
      editedAt: admin.firestore.FieldValue.serverTimestamp(),
      previousTotals: data.invoice.totals,
      newTotals: updates.totals
    });
    await doc.ref.update({
      "invoice.totals": updates.totals,
      "invoice.adjustments": updates.adjustments,
      "invoice.lastEditedAt": admin.firestore.FieldValue.serverTimestamp(),
      "invoice.lastEditedBy": request.auth.uid
    });
    return { success: true };
  }
);

// Webhook Function

const { onRequest } = require("firebase-functions/v2/https");

// const db = admin.firestore();

exports.whatsappWebhook = onRequest(async (req, res) => {

  const VERIFY_TOKEN = "my_verify_token_123";

  // =========================
  // WEBHOOK VERIFICATION
  // =========================
  if (req.method === "GET") {

    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verified");
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }

  // =========================
  // RECEIVE EVENTS
  // =========================
  if (req.method === "POST") {

    console.log("Webhook Event:", JSON.stringify(req.body));

    try {

      const entry = req.body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;

      const message = value?.messages?.[0];

      if (message) {

        const phone = message.from;
        const text = message.text?.body || "";
        const timestamp = message.timestamp;

        await db.collection("whatsapp_messages").add({
          phone: phone,
          message: text,
          timestamp: timestamp,
          direction: "incoming",
          createdAt: new Date()
        });

        console.log("Message stored:", phone, text);
      }

      return res.sendStatus(200);

    } catch (error) {

      console.error("Webhook error:", error);
      return res.sendStatus(500);

    }
  }

});

const axios = require("axios");
const { defineSecret } = require("firebase-functions/params");

const WHATSAPP_TOKEN = defineSecret("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_ID = defineSecret("WHATSAPP_PHONE_ID");

exports.sendWhatsAppReply = onCall(
  { 
    region: "asia-south1",
    secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_ID] 
  },
  async (req) => {

    const { phone, message } = req.data;

    if (!phone || !message) {
      throw new Error("Missing phone or message");
    }

    try {

      await axios.post(
        `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_ID.value()}/messages`,
        {
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body: message }
        },
        {
          headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN.value()}`,
            "Content-Type": "application/json"
          }
        }
      );

      return { success: true };

    } catch (err) {
      console.error(err.response?.data || err);
      throw new HttpsError(
        "internal",
        err.response?.data?.error?.message || err.message
      );
    }
  }
);

exports.sendWhatsApp =
  require("./whatsapp/sendRedemptionMessage").sendWhatsApp;

exports.sendAccountOpeningWhatsApp = sendAccountOpeningWhatsApp;
exports.sendInvestmentReceiptWhatsApp = sendInvestmentReceiptWhatsApp;

exports.createRedemptionRequest =
  require("./redemption/investmentRedemption").createRedemptionRequest;

exports.approveRedemptionConsent =
  require("./redemption/investmentRedemption").approveRedemptionConsent;

exports.sendKarigarOrder = 
  require("./whatsapp/karigarOrders").sendKarigarOrder;

exports.sendMarketingCampaign =
  require("./whatsapp/sendMarketingCampaign").sendMarketingCampaign;

  exports.sendMarketingToSelected =
  require("./whatsapp/sendMarketingToSelected").sendMarketingToSelected;

// exports.secureCloseSale = onCall({ region: "asia-south1" }, async (request) => {
//   if (!request.auth) {
//     throw new Error("Authentication required");
//   }

//   const {
//     estimationId,
//     exchangeItems = [],
//     investmentId = null,
//     manualDiscount = 0,
//     paymentDetails = {}
//   } = request.data || {};

//   if (!estimationId) {
//     throw new Error("Estimation ID required");
//   }

//   const estimationRef = db.collection("sales_estimations").doc(estimationId);

//   return await db.runTransaction(async (tx) => {
//     const estSnap = await tx.get(estimationRef);
//     if (!estSnap.exists) throw new Error("Estimation not found");

//     const est = estSnap.data();

//     if (est.status === "CLOSED") {
//       throw new Error("Already closed");
//     }

//     const num = (v) => Number(v) || 0;

//     /* ===============================
//        1️⃣ RE-CALCULATE ITEMS SERVER SIDE
//     =============================== */
//     let gross = 0;

//     const recalculatedItems = est.items.map(item => {
//       const r = num(item.rate);
//       const net = num(item.netWeight);
//       const stone = num(item.stoneCharges);
//       const mc = num(item.makingChargeValue);

//       let goldValue = 0;

//       if (item.makingChargeType === "GRAM") {
//         goldValue = (net + mc) * r;
//       } else if (item.makingChargeType === "PERCENT") {
//         const base = net * r;
//         goldValue = base + base * (mc / 100);
//       } else {
//         goldValue = net * r;
//       }

//       const subtotal = goldValue + stone;
//       const total = subtotal * 1.03;

//       gross += total;

//       return {
//         ...item,
//         serverGoldValue: Number(goldValue.toFixed(2)),
//         serverSubtotal: Number(subtotal.toFixed(2)),
//         serverTotal: Number(total.toFixed(2)),
//       };
//     });

//     /* ===============================
//        2️⃣ APPLY DEDUCTIONS
//     =============================== */
//     const exchangeValue = exchangeItems.reduce((s, i) => s + num(i.value), 0);

//     let investmentAmount = 0;

//     if (investmentId) {
//       const invRef = db.collection("INVESTMENTS").doc(investmentId);
//       const invSnap = await tx.get(invRef);
//       if (!invSnap.exists) throw new Error("Investment not found");

//       const inv = invSnap.data();
//       const balance = num(inv.totalAmountPaid) - num(inv.redeemedAmount);

//       investmentAmount = balance;

//       if (investmentAmount <= 0) {
//         throw new Error("No balance available");
//       }

//       tx.update(invRef, {
//         redeemedAmount: num(inv.redeemedAmount) + investmentAmount,
//         lastRedeemedAt: admin.firestore.FieldValue.serverTimestamp(),
//       });
//     }

//     const savings = investmentAmount + exchangeValue + num(manualDiscount);

//     const net = gross - savings;

//     const rounded = Math.ceil(net / 10) * 10;

//     if (rounded > 200000 && !est.customer?.pan) {
//       throw new Error("PAN required for billing above ₹2,00,000");
//     }

//     /* ===============================
//        3️⃣ MARK ITEMS SOLD
//     =============================== */
//     for (const item of est.items) {
//       const itemRef = db.collection("stock_items").doc(item.itemId);
//       tx.update(itemRef, {
//         status: "SOLD",
//         soldAt: admin.firestore.FieldValue.serverTimestamp(),
//         soldInEstimation: estimationId,
//       });
//     }

//     /* ===============================
//        4️⃣ GENERATE INVOICE NUMBER
//     =============================== */
//     const counterRef = db.collection("COUNTERS").doc("INVOICE");

//     const counterSnap = await tx.get(counterRef);
//     const serial = (counterSnap.data()?.value || 0) + 1;

//     tx.set(counterRef, { value: serial }, { merge: true });

//     const invoiceNo = `KJINV${String(serial).padStart(4, "0")}`;

//     /* ===============================
//        5️⃣ UPDATE ESTIMATION
//     =============================== */
//     tx.update(estimationRef, {
//       status: "CLOSED",
//       closedAt: admin.firestore.FieldValue.serverTimestamp(),
//       payment: {
//         reference: invoiceNo,
//         details: paymentDetails,
//       },
//       finalSummary: {
//         gross,
//         exchangeValue,
//         investmentAmount,
//         manualDiscount: num(manualDiscount),
//         savings,
//         rounded,
//       },
//       items: recalculatedItems,
//     });

//     return {
//       success: true,
//       invoiceNo,
//       finalAmount: rounded,
//     };
//   });
// });
// exports.releaseExpiredReservations = onSchedule("every 10 minutes", async () => {
//   const THREE_HOURS = 3 * 60 * 60 * 1000;
//   const cutoff = Date.now() - THREE_HOURS;

//   const snap = await db
//     .collection("stock_items")
//     .where("status", "==", "RESERVED")
//     .get();

//   const batch = db.batch();

//   snap.docs.forEach((docSnap) => {
//     const data = docSnap.data();
//     const reservedAt = data.reservedAt?.toMillis?.() || 0;

//     if (reservedAt < cutoff) {
//       batch.update(docSnap.ref, {
//         status: "IN_STOCK",
//         reservedAt: null,
//         reservedByEstimationId: null,
//       });
//     }
//   });

//   await batch.commit();
// });


// NOT EXPORTED → WILL NEVER RUN
// async function releaseExpiredReservationsManual() {
//   const THREE_HOURS = 3 * 60 * 60 * 1000;
//   const cutoff = Date.now() - THREE_HOURS;

//   const snap = await db
//     .collection("stock_items")
//     .where("status", "==", "RESERVED")
//     .get();

//   const batch = db.batch();

//   snap.docs.forEach((docSnap) => {
//     const data = docSnap.data();
//     const reservedAt = data.reservedAt?.toMillis?.() || 0;

//     if (reservedAt < cutoff) {
//       batch.update(docSnap.ref, {
//         status: "IN_STOCK",
//         reservedAt: null,
//         reservedByEstimationId: null,
//       });
//     }
//   });

//   await batch.commit();
// }


