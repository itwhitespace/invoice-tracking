"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { AppSettings } from "./types";

const SETTINGS_KEY = "docuverify_app_settings";

const defaultSettings: AppSettings = {
  geminiApiKey: "",
  supabaseUrl: "",
  supabaseAnonKey: "",
  supabaseBucket: "pdf-documents",
  useMockExtraction: false,
};

interface SettingsContextValue {
  settings: AppSettings;
  saveSettings: (settings: AppSettings) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const saveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, saveSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return ctx;
}
