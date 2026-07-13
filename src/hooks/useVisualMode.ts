import { useState, useEffect, useCallback } from "react";

export type VisualMode = "normal" | "dark" | "high-contrast" | "calm";

const STORAGE_KEY = "lockbuilder-visual-mode";

export function useVisualMode() {
  const [mode, setModeState] = useState<VisualMode>(() => {
    if (typeof window === "undefined") return "normal";
    const stored = localStorage.getItem(STORAGE_KEY) as VisualMode | null;
    if (stored && ["normal", "dark", "high-contrast", "calm"].includes(stored)) {
      return stored;
    }
    // Respect system preference
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "normal";
  });

  const setMode = useCallback((newMode: VisualMode) => {
    setModeState(newMode);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newMode);
    }
  }, []);

  const cycleMode = useCallback(() => {
    const order: VisualMode[] = ["normal", "dark", "high-contrast", "calm"];
    const idx = order.indexOf(mode);
    setMode(order[(idx + 1) % order.length]);
  }, [mode, setMode]);

  // Apply the mode class to <html>
  useEffect(() => {
    const root = document.documentElement;
    // Remove all mode classes
    root.classList.remove("mode-normal", "mode-dark", "mode-high-contrast", "mode-calm");
    root.classList.add(`mode-${mode}`);

    // Sync dark mode for any third-party Tailwind usage
    if (mode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [mode]);

  return { mode, setMode, cycleMode };
}