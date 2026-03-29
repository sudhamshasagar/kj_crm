import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { collection, query, orderBy, onSnapshot, getDocs } from "firebase/firestore";

export const useItemMaster = () => {
  const { db } = useAuth();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!db) return;

    // 1. We listen to STOCK_SUMMARY (Where HSN/Purity lives)
    const summaryQuery = query(collection(db, "STOCK_SUMMARY"));
    
    // 2. We listen to STOCK_FIFO (Where all your old item names live)
    const fifoQuery = query(collection(db, "STOCK_FIFO"), orderBy("itemName", "asc"));

    // We combine them in real-time
    const unsubFIFO = onSnapshot(fifoQuery, (fifoSnap) => {
      
      // Fetch summary once (or listen to it if you prefer strictly live updates for HSN)
      // For performance, we can just do a getDocs inside, but let's do a nested listener to be safe
      getDocs(summaryQuery).then((summarySnap) => {
        
        // A. Build a map of Metadata (HSN, Purity) from Summary
        const metaMap = {};
        summarySnap.docs.forEach(doc => {
           const d = doc.data();
           metaMap[d.itemName] = { 
               hsn: d.hsn || "", 
               purity: d.purity || "", 
               id: doc.id 
           };
        });

        // B. Get Unique Names from FIFO (Your Legacy Data)
        const uniqueItems = new Map();

        fifoSnap.docs.forEach((d) => {
          const data = d.data();
          const name = data.itemName;

          if (!uniqueItems.has(name)) {
            // Check if we have metadata for this item
            const meta = metaMap[name] || {};

            uniqueItems.set(name, {
              id: meta.id || d.id, // Use Summary ID if exists, else Log ID
              name: name,
              purity: meta.purity || data.purity || "", // Prefer Summary Purity -> Then Log Purity
              hsn: meta.hsn || "", // Prefer Summary HSN
              category: data.category || "",
            });
          }
        });

        // C. Also add items that might exist ONLY in Summary (New items with no stock yet)
        Object.keys(metaMap).forEach(name => {
            if(!uniqueItems.has(name)) {
                uniqueItems.set(name, {
                    id: metaMap[name].id,
                    name: name,
                    purity: metaMap[name].purity,
                    hsn: metaMap[name].hsn,
                    category: ""
                });
            }
        });

        // Sort alphabetically
        const sortedList = Array.from(uniqueItems.values()).sort((a, b) => 
            a.name.localeCompare(b.name)
        );

        setItems(sortedList);
      });
    });

    return () => unsubFIFO();
  }, [db]);

  return { items };
};