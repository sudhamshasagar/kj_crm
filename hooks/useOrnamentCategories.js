import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext'; // Path adjusted for src/hooks/
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

const ORNAMENT_COLLECTION = 'ornamentCategories';

export const useOrnamentCategories = () => {
    const { db } = useAuth();
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db) return;

        const collectionRef = collection(db, ORNAMENT_COLLECTION);
        const q = query(collectionRef, orderBy("name", "asc"));

        // Set up the real-time listener
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().name,
                prefix: doc.data().prefix,
            }));
            setCategories(list);
            setIsLoading(false);
        }, (error) => {
            console.error("Error listening to ornament categories:", error);
            setIsLoading(false);
        });

        // Cleanup function to unsubscribe when the component unmounts
        return () => unsubscribe();
    }, [db]);

    return { categories, isLoading };
};