import { useState, useEffect } from 'react';

// ─── Types & defaults ─────────────────────────────────────────────────────────

export interface SystemSettings {
  defaultReturnDays: number;
  overdueThresholdDays: number;
  showOverdueAlerts: boolean;
  showNoDueDateAlerts: boolean;
  itemsPerPage: number;
  vendorReturnThreshold: number;  // ← NEW: minimum item value to flag for vendor return
}

export const DEFAULT_SETTINGS: SystemSettings = {
  defaultReturnDays: 7,
  overdueThresholdDays: 0,
  showOverdueAlerts: true,
  showNoDueDateAlerts: true,
  itemsPerPage: 8,
  vendorReturnThreshold: 50000,   // ← NEW: default ₱50,000
};

export const SETTINGS_KEY = '5crg_ims_settings';

// ─── Read / write helpers ─────────────────────────────────────────────────────

export function loadSystemSettings(): SystemSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSystemSettings(s: SystemSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    console.warn('Could not save settings to localStorage.');
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the current system settings, hydrated client-side from localStorage.
 * Returns DEFAULT_SETTINGS on the first render (SSR-safe).
 */
export function useSystemSettings(): SystemSettings {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    // Safe: only runs after mount (client-side)
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {
      // localStorage unavailable — keep defaults
    }
  }, []);

  return settings;
}