import { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig'; // Adjust path to your config
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';

export const useCustomProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Reference to a new collection specifically for Custom Estimation Names
    const q = query(collection(db, "custom_product_names"), orderBy("name", "asc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const addCustomProduct = async (name) => {
    if (!name) return;
    try {
      await addDoc(collection(db, "custom_product_names"), { 
        name: name.toUpperCase(),
        createdAt: new Date() 
      });
      toast.success("Product added to list");
    } catch (error) {
      toast.error("Error saving product name");
    }
  };

  const deleteCustomProduct = async (id) => {
    try {
      await deleteDoc(doc(db, "custom_product_names", id));
    } catch (error) {
      toast.error("Error deleting");
    }
  };

  return { products, addCustomProduct, deleteCustomProduct, loading };
};