import { useState, useEffect, useCallback } from "react";
import type { VisualMode } from "./useVisualMode";

export type Theme = "standard" | "modern" | "futuristic";

const THEME_KEY = "lockbuilder-theme";
const MODE_KEY = "lockbuilder-visual-mode";
const LANG_KEY = "lockbuilder-lang";

export interface Settings {
  theme: Theme;
  mode: VisualMode;
  lang: string;
}

export function useSettings() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "standard";
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    if (stored && ["standard", "modern", "futuristic"].includes(stored)) return stored;
    return "standard";
  });

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem(THEME_KEY, newTheme);
    }
  }, []);

  // Apply theme data attribute
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return { theme, setTheme };
}
