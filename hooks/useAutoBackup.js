// src/hooks/useAutoBackup.js
import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { generateBackupData, uploadBackupToCloud } from "../utils/backupService";
import toast from "react-hot-toast";

export const useAutoBackup = (userRole) => {
  const [backupStatus, setBackupStatus] = useState("idle"); 

  useEffect(() => {
    const checkAndRunBackup = async () => {
      // 1. Only run for Admins/Developers
      if (userRole !== "Admin" && userRole !== "Developer") return;

      setBackupStatus("checking");

      try {
        const q = query(collection(db, "BACKUP_LOGS"), orderBy("createdAt", "desc"), limit(1));
        const snap = await getDocs(q);
        
        const todayStr = new Date().toISOString().split('T')[0];
        let lastBackupDate = "";

        if (!snap.empty) {
          const data = snap.docs[0].data();
          lastBackupDate = data.createdAt?.toDate().toISOString().split('T')[0];
        }

        if (lastBackupDate === todayStr) {
          setBackupStatus("up_to_date");
          return;
        }

        // 2. START BACKUP
        setBackupStatus("backing_up");
        
        // Generate Data & Track Collections
        const backupResult = await generateBackupData();
        
        // Upload to Cloud
        const fileUrl = await uploadBackupToCloud(backupResult);

        // 3. LOG TO FIRESTORE
        await addDoc(collection(db, "BACKUP_LOGS"), {
          createdAt: serverTimestamp(),
          fileUrl: fileUrl,
          triggeredBy: "Auto-System",
          status: "SUCCESS",
          collectionsCount: backupResult.collections.length,
          collectionsList: backupResult.collections // <--- This stores which collections were done
        });

        setBackupStatus("completed");
        
        // Detailed Toast showing what was backed up
        toast.success(
          `Cloud Backup Done: ${backupResult.collections.length} Collections Secured`, 
          { 
            id: "auto-backup", 
            duration: 5000,
            icon: '☁️'
          }
        );

      } catch (error) {
        console.error("Auto Backup Failed:", error);
        setBackupStatus("error");
        toast.error("System Backup Failed. Check console.");
      }
    };

    // Run backup check after 5 seconds to ensure system is settled
    const timer = setTimeout(() => {
      checkAndRunBackup();
    }, 5000);

    return () => clearTimeout(timer);
  }, [userRole]);

  return backupStatus;
};