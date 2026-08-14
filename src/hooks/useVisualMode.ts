import { useState, useEffect, useCallback } from "react";

export type VisualMode = "normal" | "dark" | "high-contrast" | "colorblind-rg" | "colorblind-by" | "calm";

const STORAGE_KEY = "lockbuilder-visual-mode";

export function useVisualMode() {
  const [mode, setModeState] = useState<VisualMode>(() => {
    if (typeof window === "undefined") return "normal";
    const stored = localStorage.getItem(STORAGE_KEY) as VisualMode | null;
    if (stored && ["normal", "dark", "high-contrast", "colorblind-rg", "colorblind-by", "calm"].includes(stored)) return stored;
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    return "normal";
  });

  const setMode = useCallback((newMode: VisualMode) => {
    setModeState(newMode);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("mode-dark", "mode-high-contrast", "mode-calm", "mode-colorblind-rg", "mode-colorblind-by");
    if (mode === "normal") return;
    const map: Record<string, string> = { "dark": "mode-dark", "high-contrast": "mode-high-contrast", "colorblind-rg": "mode-colorblind-rg", "colorblind-by": "mode-colorblind-by", "calm": "mode-calm" };
    root.classList.add(map[mode] || "");
  }, [mode]);

  return { mode, setMode };
}
