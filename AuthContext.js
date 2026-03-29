import React, { useState, useEffect, useContext, createContext } from 'react';
import { onAuthStateChanged, signOut, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, updateDoc, serverTimestamp, getDoc, onSnapshot } from "firebase/firestore";
import toast from 'react-hot-toast';

import {
  auth,
  googleProvider,
  ROLES,
  getApprovalDocRef,
  db
} from './firebaseConfig.js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(ROLES.LOGGED_OUT);
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  
  // Gatekeeper: defaults to false, but we will now set it to TRUE immediately for everyone
  const [isAdminVerified, setIsAdminVerified] = useState(false);

  /* ----------------------------------------------------
      PRESENCE
  ---------------------------------------------------- */
  const setUserOnline = async (currentUser, resolvedRole) => {
    if (!currentUser) return;
    try {
      const ref = doc(db, "ACTIVE_USERS", currentUser.uid);
      await setDoc(ref, {
        uid: currentUser.uid,
        name: currentUser.displayName || "Unknown",
        email: currentUser.email,
        role: resolvedRole || "User",      
        photoURL: currentUser.photoURL || "",
        online: true,
        lastActive: serverTimestamp()
      }, { merge: true });
    } catch (e) { console.error("Presence Error", e); }
  };

  const setUserOffline = async (uid) => {
    if (!uid) return;
    try {
      const ref = doc(db, "ACTIVE_USERS", uid);
      await updateDoc(ref, { online: false, lastActive: serverTimestamp() });
    } catch (e) { console.error(e); }
  };

  /* ----------------------------------------------------
      AUTH & REAL-TIME LISTENER
  ---------------------------------------------------- */
  useEffect(() => {
    let profileUnsubscribe = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        // CLEANUP ON LOGOUT
        setUser(null);
        setRole(ROLES.LOGGED_OUT);
        setUserData(null);
        setIsAdminVerified(false); 
        setIsLoading(false);
        if (profileUnsubscribe) profileUnsubscribe();
        return;
      }

      setUser(currentUser);

      const userDocRef = doc(db, "users", currentUser.uid);
      
      // REAL-TIME LISTENER
      profileUnsubscribe = onSnapshot(userDocRef, async (docSnap) => {
        let resolvedRole = ROLES.LOGGED_OUT;
        let data = {};

        if (docSnap.exists()) {
          data = docSnap.data();
          resolvedRole = data.role || ROLES.LOGGED_OUT;
          setUserData(data);

          // Force Logout Check
          if (data.forceLogoutTrigger === true) {
            try {
              await updateDoc(userDocRef, {
                forceLogoutTrigger: false,
                online: false,
                lastActive: serverTimestamp()
              });
            } catch (e) {
              console.error("Reset trigger error:", e);
            }
            toast.error("Session terminated by admin");
            await signOut(auth);
            window.location.href = "/";
            return;
          }
        } else {
          // Fallback: Check 'approvals' collection
          const reqSnap = await getDoc(getApprovalDocRef(currentUser.uid));
          if (reqSnap.exists()) resolvedRole = ROLES.UNAPPROVED;
        }

        setRole(resolvedRole);
        
        // --- CHANGED HERE ---
        // Previously: Checked if Admin -> wait for OTP.
        // Now: Immediately verify everyone, including Admins.
        setIsAdminVerified(true); 
        // --------------------

        await setUserOnline(currentUser, resolvedRole);
        setIsLoading(false);

      }, (error) => {
        console.error("Profile Listen Error:", error);
        setIsLoading(false);
      });
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  /* ----------------------------------------------------
      ACTIONS
  ---------------------------------------------------- */
  const loginWithGoogle = async () => {
    return await signInWithPopup(auth, googleProvider);
  };

  const handleLogout = async () => {
    if (user?.uid) await setUserOffline(user.uid);
    await signOut(auth);
    setUser(null);
    setIsAdminVerified(false);
  };

  const submitRegistrationRequest = async (uid, email, displayName, requestedRole) => {
      const requestRef = getApprovalDocRef(uid);
      await setDoc(requestRef, { uid, email, displayName, requestedRole, status: 'Pending', timestamp: new Date().toISOString() });
  };

  const value = {
    user,
    role,
    isLoading,
    userData,
    ROLES,
    db,
    loginWithGoogle,
    logout: handleLogout,
    submitRegistrationRequest,
    currentUser: user,
    isAdminVerified, 
    // verifyAdminSession function removed as it is no longer needed
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);