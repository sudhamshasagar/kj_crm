// src/utils/backupService.js
import { collection, getDocs } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebaseConfig";

// List all collections you want to include in the backup
const COLLECTIONS_TO_BACKUP = [
  "USERS",
  "CUSTOMERS",
  "ORDERS",
  "INVESTMENTS",
  "INVESTMENT_TRANSACTIONS",
  "B2B_MASTER_LOG",
  "B2J_MASTER_LOG",
  "STOCK",
  "ESTIMATIONS",
  "CORRECTION_REQUESTS",
  "BACKUP_LOGS"
];

/**
 * Fetches all data from Firestore and returns a JSON object 
 * along with a list of successfully processed collections.
 * 
 * 
 */

export const performInvestmentBackup = async (triggeredBy = "System") => {
  const collections = ["CUSTOMERS", "INVESTMENTS", "INVESTMENT_TRANSACTIONS"];
  const backupPayload = {
    timestamp: new Date().toISOString(),
    triggeredBy: triggeredBy,
    data: {}
  };

  // 1. Fetch every document from the three critical collections
  for (const colName of collections) {
    const snap = await getDocs(collection(db, colName));
    backupPayload.data[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // 2. Prepare Storage Reference
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `investment_backups/full_export_${dateStr}_${Date.now()}.json`;
  const storageRef = ref(storage, fileName);

  // 3. Upload to Firebase Storage
  await uploadString(storageRef, JSON.stringify(backupPayload));
  const downloadUrl = await getDownloadURL(storageRef);

  return {
    url: downloadUrl,
    count: {
      customers: backupPayload.data.CUSTOMERS.length,
      investments: backupPayload.data.INVESTMENTS.length,
      transactions: backupPayload.data.INVESTMENT_TRANSACTIONS.length
    }
  };
};

export const generateBackupData = async () => {
  const fullBackup = {};
  const processedCollections = [];

  for (const collectionName of COLLECTIONS_TO_BACKUP) {
    try {
      const snap = await getDocs(collection(db, collectionName));
      const docs = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      fullBackup[collectionName] = docs;
      processedCollections.push(collectionName);
    } catch (err) {
      console.error(`Error backing up ${collectionName}:`, err);
    }
  }

  return {
    data: JSON.stringify(fullBackup),
    collections: processedCollections,
    timestamp: new Date().toISOString()
  };
};

/**
 * Uploads the stringified JSON to Firebase Storage
 */
export const uploadBackupToCloud = async (backupPayload) => {
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `backups/daily_${dateStr}_${Date.now()}.json`;
  const storageRef = ref(storage, fileName);

  // Upload as a string (base64 or raw string)
  await uploadString(storageRef, backupPayload.data);
  
  // Return the download URL for logging
  return await getDownloadURL(storageRef);
};