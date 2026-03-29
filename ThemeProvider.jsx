// src/ThemeProvider.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { useAuth } from "./AuthContext";

const ThemeContext = createContext();
export const useTheme = () => useContext(ThemeContext);

const THEMES = {
  default: {
    "--primary": "#7b4b2a",
    "--primary-dark": "#5f3920",
    "--primary-light": "#d7bfa7",
    "--bg": "#f7f4f0",
    "--card": "#ffffff",
    "--text": "#2d2d2d",
  },
  sapphire: {
    "--primary": "#1e3a8a",
    "--primary-dark": "#172554",
    "--primary-light": "#93c5fd",
    "--bg": "#eef6ff",
    "--card": "#ffffff",
    "--text": "#1e293b",
  },
  emerald: {
    "--primary": "#047857",
    "--primary-dark": "#064e3b",
    "--primary-light": "#6ee7b7",
    "--bg": "#ecfdf5",
    "--card": "#ffffff",
    "--text": "#1f2937",
  },
  ruby: {
    "--primary": "#b91c1c",
    "--primary-dark": "#7f1d1d",
    "--primary-light": "#fecaca",
    "--bg": "#fff5f5",
    "--card": "#ffffff",
    "--text": "#2d2d2d",
  },
  onyx: {
    "--primary": "#facc15",
    "--primary-dark": "#ca8a04",
    "--primary-light": "#fef08a",
    "--bg": "#1f1f1f",
    "--card": "#2d2d2d",
    "--text": "#f8f8f8",
  },
  pearl: {
    "--primary": "#6b7280",
    "--primary-dark": "#4b5563",
    "--primary-light": "#e5e7eb",
    "--bg": "#f9fafb",
    "--card": "#ffffff",
    "--text": "#1f2937",
  },
};

export const ThemeProvider = ({ children }) => {
  const { user } = useAuth();
  const [theme, setTheme] = useState("default");

  useEffect(() => {
    if (!user) return;

    const ref = doc(db, "SHOP_SETTINGS", "THEME");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const saved = snap.data().theme || "default";
        setTheme(saved);
        applyTheme(saved);
      }
    });

    return () => unsub();
  }, [user]);

  const applyTheme = (t) => {
    const vars = THEMES[t];
    if (!vars) return;
    Object.keys(vars).forEach((k) => {
      document.documentElement.style.setProperty(k, vars[k]);
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
};
