import { useState } from "react";
import type { Theme } from "~/hooks/useSettings";
import type { VisualMode } from "~/hooks/useVisualMode";
import type { Language } from "~/i18n/translations";
import { LANGUAGES } from "~/i18n/translations";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  mode: VisualMode;
  setMode: (m: VisualMode) => void;
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
}

const THEME_OPTIONS: { key: Theme; label: string; preview: string }[] = [
  { key: "standard", label: "Standard", preview: "#1B2A4A" },
  { key: "modern", label: "Modern", preview: "#C8963E" },
  { key: "futuristic", label: "Futuristic", preview: "#00FFFF" },
];

const MODE_OPTIONS: { key: VisualMode; label: string; icon: string }[] = [
  { key: "normal", label: "Light mode", icon: "☀️" },
  { key: "dark", label: "Dark mode", icon: "🌙" },
  { key: "high-contrast", label: "High contrast", icon: "🔲" },
  { key: "calm", label: "Calm mode", icon: "🌀" },
];

export function SettingsPanel({ open, onClose, theme, setTheme, mode, setMode, lang, setLang, t }: SettingsPanelProps) {
  const [tab, setTab] = useState<"appearance" | "mode" | "language">("appearance");

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-sm overflow-y-auto shadow-2xl"
        style={{
          backgroundColor: "var(--bg-primary)",
          color: "var(--text-primary)",
          borderLeft: "1px solid var(--border-color)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--border-color)" }}>
          <h2 className="text-lg font-bold">{t("Settings")}</h2>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              border: "none",
            }}>
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: "var(--border-color)" }}>
          {(["appearance", "mode", "language"] as const).map((tKey) => (
            <button
              key={tKey}
              onClick={() => setTab(tKey)}
              className="flex-1 py-3 text-sm font-medium transition-colors"
              style={{
                backgroundColor: tab === tKey ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent",
                color: tab === tKey ? "var(--accent)" : "var(--text-muted)",
                borderBottom: tab === tKey ? "2px solid var(--accent)" : "2px solid transparent",
                cursor: "pointer",
                borderTop: "none",
                borderLeft: "none",
                borderRight: "none",
                minHeight: "44px",
              }}>
              {tKey === "appearance" ? t("Appearance") : tKey === "mode" ? t("Display Mode") : t("Language")}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4">
          {tab === "appearance" && (
            <div className="space-y-3">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setTheme(opt.key)}
                  className="w-full rounded-xl border-2 p-4 text-left transition-all"
                  style={{
                    borderColor: theme === opt.key ? "var(--accent)" : "var(--border-color)",
                    backgroundColor: theme === opt.key ? "color-mix(in srgb, var(--accent) 5%, transparent)" : "var(--bg-secondary)",
                    cursor: "pointer",
                    minHeight: "60px",
                  }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-8 w-8 rounded-full"
                      style={{ backgroundColor: opt.preview }}
                    />
                    <div>
                      <div className="font-semibold" style={{ color: "var(--text-primary)" }}>{t(opt.label)}</div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {opt.key === "standard" ? "Clean, professional" : opt.key === "modern" ? "Art Deco elegance" : "SciFi cyber aesthetic"}
                      </div>
                    </div>
                    {theme === opt.key && (
                      <span className="ml-auto text-lg" style={{ color: "var(--accent)" }}>✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {tab === "mode" && (
            <div className="space-y-3">
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setMode(opt.key)}
                  className="w-full rounded-xl border-2 p-4 text-left transition-all flex items-center gap-3"
                  style={{
                    borderColor: mode === opt.key ? "var(--accent)" : "var(--border-color)",
                    backgroundColor: mode === opt.key ? "color-mix(in srgb, var(--accent) 5%, transparent)" : "var(--bg-secondary)",
                    cursor: "pointer",
                    minHeight: "56px",
                  }}>
                  <span className="text-2xl">{opt.icon}</span>
                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{t(opt.label)}</span>
                  {mode === opt.key && (
                    <span className="ml-auto text-lg" style={{ color: "var(--accent)" }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {tab === "language" && (
            <div className="space-y-1">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className="w-full rounded-lg p-3 text-left transition-colors flex items-center justify-between"
                  style={{
                    backgroundColor: lang === l.code ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
                    cursor: "pointer",
                    border: "none",
                    minHeight: "48px",
                    color: "var(--text-primary)",
                  }}>
                  <div>
                    <span className="font-medium">{l.native}</span>
                    <span className="ml-2 text-sm" style={{ color: "var(--text-muted)" }}>{l.name}</span>
                  </div>
                  {lang === l.code && (
                    <span style={{ color: "var(--accent)" }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
