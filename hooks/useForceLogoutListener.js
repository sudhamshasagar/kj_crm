import { useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebaseConfig'; // Adjust path as needed
import { useAuth } from '../AuthContext'; // Adjust path as needed
import toast from 'react-hot-toast';

export const useForceLogoutListener = () => {
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) return;

    // Listen to the specific user's document
    const userRef = doc(db, "USERS", currentUser.uid);

    const unsubscribe = onSnapshot(userRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();

        // Check if the forceLogoutTrigger field exists and is true
        if (data.forceLogoutTrigger === true) {
          
          // 1. Reset the flag so they can log in again later
          await updateDoc(userRef, {
            forceLogoutTrigger: false,
            isOnline: false // Optional: Mark them offline immediately
          });

          // 2. Perform the logout
          await signOut(auth);
          
          // 3. UI Feedback
          toast.error("Session Terminated by Administrator");
          window.location.href = "/login"; // Force redirect
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser]);
};