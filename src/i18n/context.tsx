import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { Language } from "./translations";
import { t as translate, LANGUAGES } from "./translations";

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  t: (key: string) => key,
});

const STORAGE_KEY = "lockbuilder-lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window === "undefined") return "en";
    const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored && LANGUAGES.some((l) => l.code === stored)) return stored;
    return "en";
  });

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newLang);
    }
  }, []);

  // Apply RTL direction
  useEffect(() => {
    const langInfo = LANGUAGES.find((l) => l.code === lang);
    if (langInfo?.rtl) {
      document.documentElement.setAttribute("dir", "rtl");
    } else {
      document.documentElement.removeAttribute("dir");
    }
  }, [lang]);

  const t = useCallback(
    (key: string) => translate(lang, key),
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
