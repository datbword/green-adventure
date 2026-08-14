import { useState } from "react";
import type { VisualMode } from "~/hooks/useVisualMode";
import type { Language } from "~/i18n/translations";
import { LANGUAGES } from "~/i18n/translations";

const MODES: { id: VisualMode; label: string; icon: string; desc: string }[] = [
  { id: "normal", label: "Normal", icon: "☀️", desc: "Light background, navy accents" },
  { id: "dark", label: "Dark", icon: "🌙", desc: "Near-black with light gray text" },
  { id: "high-contrast", label: "High Contrast", icon: "🔲", desc: "WCAG AAA — black bg, white & yellow text" },
  { id: "colorblind-rg", label: "Colorblind: Red-Green", icon: "🔵", desc: "Blue/orange replaces red/green" },
  { id: "colorblind-by", label: "Colorblind: Blue-Yellow", icon: "🟠", desc: "Orange accents, safe pairings" },
  { id: "calm", label: "Calm", icon: "🌀", desc: "Sepia filter, warm tones, slow animations" },
];

interface SettingsPanelProps {
  open: boolean; onClose: () => void;
  lang: Language; setLang: (l: Language) => void; t: (key: string) => string;
  mode: VisualMode; setMode: (m: VisualMode) => void;
}
export function SettingsPanel({ open, onClose, lang, setLang, t, mode, setMode }: SettingsPanelProps) {
  const [tab, setTab] = useState<"mode" | "language">("mode");
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm overflow-y-auto shadow-2xl"
        style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", borderLeft: "1px solid var(--border-color)" }}>
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--border-color)" }}>
          <h2 className="text-lg font-bold">{t("Settings")}</h2>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
            style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", cursor: "pointer", border: "none" }}>✕</button>
        </div>
        <div className="flex border-b" style={{ borderColor: "var(--border-color)" }}>
          {(["mode", "language"] as const).map((tKey) => (
            <button key={tKey} onClick={() => setTab(tKey)} className="flex-1 py-3 text-sm font-medium transition-colors"
              style={{ backgroundColor: tab === tKey ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent", color: tab === tKey ? "var(--accent)" : "var(--text-muted)", borderBottom: tab === tKey ? "2px solid var(--accent)" : "2px solid transparent", cursor: "pointer", minHeight: "44px", borderTop: "none", borderLeft: "none", borderRight: "none" }}>
              {tKey === "mode" ? t("Display Mode") : t("Language")}
            </button>
          ))}
        </div>
        <div className="p-4">
          {tab === "mode" && (
            <div className="space-y-2">
              {MODES.map((m) => (
                <button key={m.id} onClick={() => setMode(m.id)}
                  className="w-full rounded-xl border-2 p-3 text-left flex items-center gap-3"
                  style={{ borderColor: mode === m.id ? "var(--accent)" : "var(--border-color)", backgroundColor: mode === m.id ? "color-mix(in srgb, var(--accent) 5%, transparent)" : "var(--bg-secondary)", minHeight: "56px", cursor: "pointer" }}>
                  <span className="text-xl">{m.icon}</span>
                  <div className="flex-1">
                    <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{t(m.label)}</span>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{m.desc}</p>
                  </div>
                  <span className="text-lg" style={{ color: "var(--accent)" }}>{mode === m.id ? "●" : "○"}</span>
                </button>
              ))}
            </div>
          )}
          {tab === "language" && (
            <div className="space-y-1">
              {LANGUAGES.map((l) => (
                <button key={l.code} onClick={() => setLang(l.code)} className="w-full rounded-lg p-3 text-left transition-colors flex items-center justify-between"
                  style={{ backgroundColor: lang === l.code ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent", cursor: "pointer", border: "none", minHeight: "48px", color: "var(--text-primary)" }}>
                  <div><span className="font-medium">{l.native}</span><span className="ml-2 text-sm" style={{ color: "var(--text-muted)" }}>{l.name}</span></div>
                  {lang === l.code && <span style={{ color: "var(--accent)" }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
