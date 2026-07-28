import { useState, useMemo, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile, readdir } from "node:fs/promises";
import { SearchableSelect } from "~/components/SearchableSelect";
import { AuthModal } from "~/components/AuthModal";
import { UserMenu } from "~/components/UserMenu";
import { SaveToJobModal } from "~/components/SaveToJobModal";
import { SettingsPanel } from "~/components/SettingsPanel";
import { ContactModal, type ContactInfo } from "~/components/ContactModal";
import { buildPartNumber, buildPartialPartNumber, findCrossReferences, isComplete, getActiveFields, getFieldCounts, getFieldLabel, getFieldPlaceholder } from "~/utils/part-builder";
import { decodePartNumber, tryPartialDecode, generateSuggestions, type DecodeResult, type Suggestion } from "~/utils/part-decoder";
import type { ConversionResult } from "~/utils/option-converter";
import { useVisualMode } from "~/hooks/useVisualMode";
import { useSettings } from "~/hooks/useSettings";
import { useAuth } from "~/hooks/useAuth";
import { I18nProvider, useI18n } from "~/i18n/context";
import type { ManufacturerData, ManufacturerOption, ProductSeries, SeriesOption, Selection, DataCache, CrossRefFamily } from "~/types";
import { CrossReferences } from "~/components/CrossReferences";
import { buildSearchIndex, searchProducts, getFilterOptions, type SearchFilters, type SearchResult } from "~/utils/product-search";
import type { SavedPart } from "~/utils/jobs";

// ── Server Data Loading ──

async function loadJson<T>(path: string): Promise<T> {
  const content = await readFile(path, "utf8");
  return JSON.parse(content) as T;
}

const loadAllData = createServerFn({ method: "GET" }).handler(async (): Promise<DataCache> => {
  const base = "/home/team/shared/data";
  const allFiles = await readdir(base);
  // Exclude non-manufacturer files (shared data files, not manufacturer-specific)
  const nonManufacturerFiles = new Set([
    "finishes.json", "functions.json", "keyways.json",
    "handings.json", "backsets.json", "cross-references.json",
    "manufacturers.json", "part-formats.json",
  ]);
  // Load all JSON files that aren't non-manufacturer files
  // Each manufacturer file contains a ManufacturerData object with a `manufacturer` field
  const manuFiles = allFiles.filter((f) => f.endsWith(".json") && !nonManufacturerFiles.has(f));
  const manufacturerFiles: Record<string, ManufacturerData> = {};
  const manufacturers: ManufacturerOption[] = [];

  for (const file of manuFiles) {
    const id = file.replace(".json", "");
    const data = await loadJson<ManufacturerData>(`${base}/${file}`);
    manufacturerFiles[id] = data;
    manufacturers.push({ id, name: data.manufacturer });
  }
  manufacturers.sort((a, b) => a.name.localeCompare(b.name));

  // Load cross-references data
  let crossReferences = null;
  if (allFiles.includes("cross-references.json")) {
    try {
      crossReferences = await loadJson<{ families: CrossRefFamily[] }>(`${base}/cross-references.json`);
    } catch {
      crossReferences = null;
    }
  }

  return { manufacturers, manufacturerFiles, crossReferences };
});

export const Route = createFileRoute("/")({
  loader: () => loadAllData(),
  component: () => (
    <I18nProvider>
      <Home />
    </I18nProvider>
  ),
});

// ── Visual Mode ──

function Home() {
  const data = Route.useLoaderData();
  const { mode, setMode } = useVisualMode();
  const { theme, setTheme } = useSettings();
  const { t, lang, setLang } = useI18n();
  const { user, showAuth, setShowAuth, saveSession, clearSession } = useAuth();
  const [saveJobPart, setSaveJobPart] = useState<SavedPart | null>(null);
  const [saveToast, setSaveToast] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  // Decode mode state
  const [tabMode, setTabMode] = useState<"build" | "decode" | "find">("build");
  const [decodeInput, setDecodeInput] = useState("");
  const [decodeResult, setDecodeResult] = useState<DecodeResult | null>(null);
  const [decodeAllResults, setDecodeAllResults] = useState<DecodeResult[]>([]);
  const [decodeError, setDecodeError] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Find mode state
  const [findQuery, setFindQuery] = useState("");
  const [findCategory, setFindCategory] = useState<string>("");
  const [findGrade, setFindGrade] = useState<string>("");
  const [findCommercial, setFindCommercial] = useState<boolean | undefined>(undefined);

  const defaultSelection: Selection = {
    manufacturerId: null,
    manufacturerName: null,
    series: null,
    pins: null,
    options: {},
  };

  const [selection, setSelection] = useState<Selection>({ ...defaultSelection });
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);

  const updateSelection = (key: string, value: SeriesOption | string | null) => {
    // When manufacturer changes, preserve universal options and convert where possible
    if (key === "manufacturerId") {
      const id = value as string | null;
      const prevManufacturerId = selection.manufacturerId;
      const hadSelections = selection.options && Object.keys(selection.options).length > 0;

      if (hadSelections && id && id !== prevManufacturerId) {
        const oldOpts = { ...selection.options };
        const keptOptions: Record<string, SeriesOption | null> = {};
        const convertedFields: string[] = [];
        const skippedFields: string[] = [];
        const keptFields: string[] = [];

        // Universal fields — direct keep
        for (const key of ["handing", "backset"]) {
          if (oldOpts[key]) { keptOptions[key] = oldOpts[key]; keptFields.push(key); }
        }
        // Standard fields — keep but validate later
        for (const key of ["keyway", "cylinderPrep", "function", "voltage", "size", "length"]) {
          if (oldOpts[key]) { keptOptions[key] = oldOpts[key]; keptFields.push(key); }
        }

        // Try ANSI finish conversion
        if (oldOpts.finish) {
          const newBrandData = data.manufacturerFiles[id];
          if (newBrandData) {
            let bestMatch: SeriesOption | null = null;
            const oldCode = oldOpts.finish.code;
            const oldName = oldOpts.finish.name.toLowerCase();
            for (const product of newBrandData.products) {
              for (const f of product.options?.finish ?? []) {
                if (f.code === oldCode) { bestMatch = f; break; }
              }
              if (bestMatch) break;
            }
            if (!bestMatch) {
              for (const product of newBrandData.products) {
                for (const f of product.options?.finish ?? []) {
                  if (f.name.toLowerCase() === oldName) { bestMatch = f; break; }
                }
                if (bestMatch) break;
              }
            }
            if (bestMatch) {
              keptOptions.finish = bestMatch;
              convertedFields.push("finish");
            } else {
              skippedFields.push("finish");
            }
          } else {
            skippedFields.push("finish");
          }
        }

        const totalAttempted = convertedFields.length + keptFields.length + skippedFields.length;
        if (totalAttempted > 0) {
          const convMap: Record<string, { from: SeriesOption; to: SeriesOption }> = {};
          for (const k of convertedFields) {
            if (oldOpts[k] && keptOptions[k]) {
              convMap[k] = { from: oldOpts[k]!, to: keptOptions[k]! };
            }
          }
          setConversionResult({ converted: convMap, skipped: skippedFields, attempted: convertedFields.length + skippedFields.length });
          setTimeout(() => setConversionResult(null), 6000);
        }

        setSelection({
          manufacturerId: id,
          manufacturerName: id ? data.manufacturers.find((m) => m.id === id)?.name ?? null : null,
          series: null, pins: null,
          options: keptOptions,
        });
        return;
      }

      setConversionResult(null);
      setSelection({
        ...defaultSelection,
        manufacturerId: id,
        manufacturerName: id ? data.manufacturers.find((m) => m.id === id)?.name ?? null : null,
      });
      return;
    }
    if (key === "series") {
      const newSeries = value as unknown as ProductSeries | null;
      setConversionResult(null);
      // Try cross-brand conversion from preserved options
      if (newSeries && selection.options && Object.keys(selection.options).length > 0) {
        const currentOpts = { ...selection.options };
        // Validate each kept option against the new series's available options
        const validated: Record<string, SeriesOption | null> = {};
        const convertedFields: string[] = [];
        const skippedFields: string[] = [];
        for (const [optKey, optValue] of Object.entries(currentOpts)) {
          if (!optValue) continue;
          const available = newSeries.options?.[optKey];
          if (!available || available.length === 0) {
            skippedFields.push(optKey);
            continue;
          }
          // Check if the exact code exists in the new series
          const exactMatch = available.find((o) => o.code === optValue.code);
          if (exactMatch) {
            validated[optKey] = exactMatch;
            convertedFields.push(optKey);
          } else {
            // Try name match
            const nameMatch = available.find((o) => o.name.toLowerCase() === optValue.name.toLowerCase());
            if (nameMatch) {
              validated[optKey] = nameMatch;
              convertedFields.push(optKey);
            } else {
              skippedFields.push(optKey);
            }
          }
        }
        if (convertedFields.length > 0 || skippedFields.length > 0) {
          const convMap: Record<string, { from: SeriesOption; to: SeriesOption }> = {};
          for (const k of convertedFields) {
            if (currentOpts[k] && validated[k]) {
              convMap[k] = { from: currentOpts[k]!, to: validated[k]! };
            }
          }
          setConversionResult({ converted: convMap, skipped: skippedFields, attempted: convertedFields.length + skippedFields.length });
          setTimeout(() => setConversionResult(null), 6000);
        }
        setSelection((prev) => ({
          ...prev,
          series: newSeries,
          options: Object.keys(validated).length > 0 ? validated : {},
          pins: null,
        }));
        return;
      }
      setSelection((prev) => ({
        ...prev,
        series: value as unknown as ProductSeries | null,
        options: {},
        pins: null,
      }));
      return;
    }
    setSelection((prev) => ({
      ...prev,
      options: { ...prev.options, [key]: value },
    }));
  };

  const clearAll = () => {
    setSelection({ ...defaultSelection });
    setConversionResult(null);
  };

  // Auto-select pin count when keyway has only one available pin option
  useEffect(() => {
    const keyway = selection.options.keyway;
    if (keyway?.availablePins && keyway.availablePins.length === 1) {
      const onlyPin = keyway.availablePins[0];
      if (selection.pins !== onlyPin) {
        setSelection((prev) => ({ ...prev, pins: onlyPin }));
      }
    }
  }, [selection.options.keyway]);

  // Auto-select single-option fields
  useEffect(() => {
    if (!selection.series) return;
    const activeFields = getActiveFields(selection.series);
    const updated: Record<string, SeriesOption | null> = {};
    let changed = false;
    for (const key of activeFields) {
      const options = selection.series.options[key];
      if (options && options.length === 1 && !selection.options[key]) {
        updated[key] = options[0];
        changed = true;
      }
    }
    if (changed) {
      setSelection((prev) => ({
        ...prev,
        options: { ...prev.options, ...updated },
      }));
    }
  }, [selection.series]);

  // Detect conflicts: selections that are mutually exclusive
  const warnings = useMemo(() => {
    const w: string[] = [];
    if (!selection.series) return w;
    const activeFields = getActiveFields(selection.series);
    for (const key of activeFields) {
      // Check if a field has options but selected value doesn't match any
      const selected = selection.options[key];
      if (selected) {
        const options = selection.series.options[key];
        if (options && options.length > 0) {
          const stillExists = options.some((o) => o.code === selected.code);
          if (!stillExists) {
            w.push(`${getFieldLabel(key)} "${selected.name}" is no longer available — please re-select.`);
          }
        }
      }
    }
    // Pin count vs keyway warning
    const keyway = selection.options.keyway;
    if (keyway?.availablePins && keyway.availablePins.length > 1 && selection.pins !== null) {
      if (!keyway.availablePins.includes(selection.pins)) {
        w.push(`Pin count ${selection.pins} is not available for selected keyway "${keyway.name}".`);
      }
    }
    return w;
  }, [selection]);

  const currentManufacturer = selection.manufacturerId ? data.manufacturerFiles[selection.manufacturerId] : null;

  // Determine active fields based on the selected series
  const activeFields = useMemo(() => {
    if (!selection.series) return [];
    return getActiveFields(selection.series);
  }, [selection.series]);

  // Field counts
  const { total: fieldTotal, selected: fieldSelected } = useMemo(() => {
    return getFieldCounts(selection.series, selection);
  }, [selection.series, selection]);

  // Build the full part number (only when complete)
  const partNumber = useMemo(() => {
    if (!selection.series || !isComplete(selection)) return null;
    return buildPartNumber(selection, selection.series);
  }, [selection]);

  // Build the partial part number (always, even when incomplete)
  const partialPartNumber = useMemo(() => {
    if (!selection.series) return null;
    // Only show partial if at least one field is selected
    if (fieldSelected === 0) return null;
    return buildPartialPartNumber(selection, selection.series);
  }, [selection, fieldSelected]);

  // Cross-references from the manufacturer data (exact part number matches)
  const crossRefs = useMemo(() => {
    if (!partNumber || !currentManufacturer) return [];
    return findCrossReferences(partNumber, currentManufacturer.crossReferences);
  }, [partNumber, currentManufacturer]);

  // Series-based cross-references from cross-references.json
  const seriesCrossRefFamilies = useMemo(() => {
    if (!data.crossReferences?.families || !selection.series || !selection.manufacturerId) return [];
    const seriesCode = selection.series.series;
    const mfrId = selection.manufacturerId;
    return data.crossReferences.families.filter((family) =>
      family.products.some((p) => p.manufacturerId === mfrId && p.series === seriesCode)
    );
  }, [data.crossReferences, selection.series, selection.manufacturerId]);

  // Build manufacturer name map for CrossReferences component
  const manufacturerNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of data.manufacturers) {
      map[m.id] = m.name;
    }
    return map;
  }, [data.manufacturers]);

  // Search index for Find tab
  const searchIndex = useMemo(() => buildSearchIndex(data.manufacturerFiles), [data.manufacturerFiles]);
  const filterOptions = useMemo(() => getFilterOptions(searchIndex), [searchIndex]);

  const findResults = useMemo(() => {
    const filters: SearchFilters = {
      query: findQuery,
      category: findCategory || undefined,
      grade: findGrade || undefined,
      commercial: findCommercial,
    };
    return searchProducts(searchIndex, filters, 40);
  }, [searchIndex, findQuery, findCategory, findGrade, findCommercial]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 sm:py-8">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between sm:mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold text-white shadow-sm"
            style={{ backgroundColor: mode === "high-contrast" ? "#000" : mode === "calm" ? "#6B6B6B" : "#1B2A4A" }}>
            LB
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl" style={{ color: "var(--text-primary)" }}>{t("LockBuilder")}</h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{tabMode === "build" ? t("Part Number Builder") : tabMode === "decode" ? t("Part Number Decoder") : t("Find Products")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link to="/functions" className="mode-toggle-btn" title="Lock Functions" aria-label="Lock Functions">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: "var(--text-secondary)" }}>
              {/* Lever handle — horizontal bar */}
              <rect x="2" y="7" width="14" height="4" rx="1.5" fill="currentColor" opacity="0.4"/>
              {/* Curved arrow showing push/pull direction */}
              <path d="M13 5C13 5 15 5 15 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              <path d="M13 5L11.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            </svg>
          </Link>
          <Link to="/handing" className="mode-toggle-btn" title="Door Handing" aria-label="Door Handing">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: "var(--text-secondary)" }}>
              {/* Door with hinge dots */}
              <rect x="2" y="3" width="14" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
              <circle cx="4" cy="5" r="1" fill="currentColor"/>
              <circle cx="4" cy="9" r="1" fill="currentColor"/>
              <circle cx="4" cy="13" r="1" fill="currentColor"/>
              {/* Arrow inside */}
              <path d="M6 9L12 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M10 7L12 9L10 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <Link to="/donjo" className="mode-toggle-btn" title="Don-Jo Catalog" aria-label="Don-Jo Catalog">
            <span className="text-xs font-semibold tracking-wider" style={{ color: "var(--text-secondary)" }}>DON-JO</span>
          </Link>
          {user ? (
            <div className="flex items-center gap-1 sm:gap-2">
              <Link to="/jobs" className="mode-toggle-btn" title="My Jobs" aria-label="My Jobs">
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>&#9776;</span>
              </Link>
              <UserMenu user={user} onSignOut={clearSession} />
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)}
              className="mode-toggle-btn" title="Sign in" aria-label="Sign in">
              <span className="text-xs font-semibold tracking-widest" style={{ color: "var(--text-secondary)" }}>LOGIN</span>
            </button>
          )}
          <button className="mode-toggle-btn" onClick={() => setSettingsOpen(true)} title={t("Settings")}
            aria-label={t("Settings")}>
            <span className="text-base">⚙</span>
          </button>
        </div>
      </header>

      {/* Mode Tabs */}
      <div className="mb-5 flex rounded-xl p-1" style={{ backgroundColor: "var(--bg-tertiary)" }}>
        <button
          onClick={() => setTabMode("build")}
          className="flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors"
          style={{
            backgroundColor: tabMode === "build" ? "var(--bg-primary)" : "transparent",
            color: tabMode === "build" ? "var(--text-primary)" : "var(--text-muted)",
            boxShadow: tabMode === "build" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            cursor: "pointer",
            minHeight: "44px",
            border: "none",
          }}>
          🔧 {t("Build")}
        </button>
        <button
          onClick={() => setTabMode("decode")}
          className="flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors"
          style={{
            backgroundColor: tabMode === "decode" ? "var(--bg-primary)" : "transparent",
            color: tabMode === "decode" ? "var(--text-primary)" : "var(--text-muted)",
            boxShadow: tabMode === "decode" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            cursor: "pointer",
            minHeight: "44px",
            border: "none",
          }}>
          🔍 {t("Decode")}
        </button>
        <button
          onClick={() => setTabMode("find")}
          className="flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors"
          style={{
            backgroundColor: tabMode === "find" ? "var(--bg-primary)" : "transparent",
            color: tabMode === "find" ? "var(--text-primary)" : "var(--text-muted)",
            boxShadow: tabMode === "find" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            cursor: "pointer",
            minHeight: "44px",
            border: "none",
          }}>
          🔎 {t("Find")}
        </button>
      </div>

      {/* ── Decode Mode ── */}
      {tabMode === "decode" && (
        <div className="space-y-4">
          {/* Decode Input */}
          <div className="relative">
            <label className="label-text">Paste a Part Number</label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={decodeInput}
                onChange={(e) => {
                  setDecodeInput(e.target.value);
                  setDecodeResult(null);
                  setDecodeAllResults([]);
                  setDecodeError("");
                  // Generate suggestions
                  const val = e.target.value;
                  if (val.length >= 1) {
                    const suggs = generateSuggestions(val, data.manufacturerFiles, 12);
                    setSuggestions(suggs);
                    setShowSuggestions(suggs.length > 0);
                    setActiveSuggestion(-1);
                  } else {
                    setSuggestions([]);
                    setShowSuggestions(false);
                  }
                }}
                onKeyDown={(e) => {
                  // Handle suggestion navigation
                  if (showSuggestions && suggestions.length > 0) {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActiveSuggestion((i) => Math.min(i + 1, suggestions.length - 1));
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActiveSuggestion((i) => Math.max(i - 1, 0));
                      return;
                    }
                    if (e.key === "Enter" && activeSuggestion >= 0) {
                      e.preventDefault();
                      const selected = suggestions[activeSuggestion];
                      setDecodeInput(selected.partNumber);
                      setShowSuggestions(false);
                      setSuggestions([]);
                      const result = decodePartNumber(selected.partNumber, data.manufacturerFiles, selected.manufacturerId);
                      if (result) { setDecodeResult(result); setDecodeAllResults([]); setDecodeError(""); }
                      return;
                    }
                    if (e.key === "Escape") {
                      setShowSuggestions(false);
                      return;
                    }
                  }
                  // Original decode logic
                  if (e.key === "Enter") {
                    const result = decodePartNumber(decodeInput, data.manufacturerFiles);
                    if (result) {
                      setDecodeResult(result);
                      setDecodeAllResults([]);
                      setDecodeError("");
                    } else {
                      const partials = tryPartialDecode(decodeInput, data.manufacturerFiles);
                      if (partials.length > 0) {
                        setDecodeAllResults(partials);
                        setDecodeResult(null);
                        setDecodeError("");
                      } else {
                        setDecodeResult(null);
                        setDecodeAllResults([]);
                        setDecodeError("Could not identify the manufacturer or part number. Check the format and try again.");
                      }
                    }
                  }
                }}
                placeholder="e.g. QL81-SR-26D-306-Q71-IC"
                className="w-full rounded-lg border px-4 py-3 text-sm transition-colors"
                style={{
                  backgroundColor: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  borderColor: "var(--border-color)",
                  minHeight: "48px",
                  outline: "none",
                }}
              />
              <button
                onClick={() => {
                  const result = decodePartNumber(decodeInput, data.manufacturerFiles);
                  if (result) {
                    setDecodeResult(result);
                    setDecodeAllResults([]);
                    setDecodeError("");
                  } else {
                    const partials = tryPartialDecode(decodeInput, data.manufacturerFiles);
                    if (partials.length > 0) {
                      setDecodeAllResults(partials);
                      setDecodeResult(null);
                      setDecodeError("");
                    } else {
                      setDecodeResult(null);
                      setDecodeAllResults([]);
                      setDecodeError("Could not identify the manufacturer or part number. Check the format and try again.");
                    }
                  }
                }}
                className="rounded-lg px-5 py-3 text-sm font-semibold text-white transition-colors"
                style={{
                  backgroundColor: "var(--accent)",
                  cursor: "pointer",
                  minHeight: "48px",
                  border: "none",
                }}>
                Decode
              </button>
            </div>
          </div>

          {/* Autocomplete suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 mt-1 w-full max-h-72 overflow-auto rounded-lg border shadow-lg"
              style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-secondary)" }}>
              {suggestions.map((s, i) => (
                <div
                  key={s.partNumber}
                  className="px-4 py-2.5 cursor-pointer transition-colors flex flex-col gap-0.5"
                  style={{
                    backgroundColor: i === activeSuggestion ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent",
                    borderLeft: i === activeSuggestion ? "3px solid var(--accent)" : "3px solid transparent",
                    cursor: "pointer",
                    minHeight: "44px",
                  }}
                  onClick={() => {
                    setDecodeInput(s.partNumber);
                    setShowSuggestions(false);
                    setSuggestions([]);
                    const result = decodePartNumber(s.partNumber, data.manufacturerFiles, s.manufacturerId);
                    if (result) { setDecodeResult(result); setDecodeAllResults([]); setDecodeError(""); }
                  }}
                  onMouseEnter={() => setActiveSuggestion(i)}
                >
                  <span className="font-mono text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {s.partNumber.substring(0, s.matchStart)}
                    <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                      {s.partNumber.substring(s.matchStart, s.matchEnd)}
                    </span>
                    {s.partNumber.substring(s.matchEnd)}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {s.manufacturerName} — {s.seriesName}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Error message */}
          {decodeError && (
            <div className="rounded-xl border p-5" style={{
              borderColor: "color-mix(in srgb, #d32f2f 30%, transparent)",
              backgroundColor: "color-mix(in srgb, #d32f2f 8%, transparent)",
            }}>
              <p className="text-sm" style={{ color: "#d32f2f" }}>{decodeError}</p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Tip: Try removing extra spaces, or try a simpler part number format. Supported manufacturers: Arrow, Schlage, BEST, Corbin Russwin, GMS, Von Duprin, and 60+ others.
              </p>
            </div>
          )}

          {/* Partial/multiple matches */}
          {decodeAllResults.length > 1 && (
            <div className="rounded-xl border p-5" style={{
              borderColor: "color-mix(in srgb, var(--brass) 30%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--brass) 6%, transparent)",
            }}>
              <p className="mb-3 text-sm font-semibold" style={{ color: "var(--brass)" }}>Multiple possible matches found</p>
              <div className="space-y-3">
                {decodeAllResults.map((r, i) => (
                  <div key={i} className="rounded-lg border p-4 cursor-pointer transition-colors"
                    style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-secondary)" }}
                    onClick={() => {
                      const result = decodePartNumber(r.partNumber, data.manufacturerFiles);
                      if (result) {
                        setDecodeResult(result);
                        setDecodeAllResults([]);
                        setDecodeInput(result.partNumber);
                      }
                    }}>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{r.manufacturerName} — {r.seriesName}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Pattern: {r.series}</p>
                    <p className="mt-1 font-mono text-sm" style={{ color: "var(--accent)" }}>{r.partNumber}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full decode result */}
          {decodeResult && (
            <div className="rounded-xl border p-5" style={{
              borderColor: "color-mix(in srgb, var(--success) 30%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--success) 6%, transparent)",
            }}>
              <div className="mb-4">
                <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--success)" }}>Decoded Part Number</p>
                <p className="mt-1 font-mono text-lg font-bold" style={{ color: "var(--text-primary)" }}>{decodeResult.partNumber}</p>
                <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
                  {decodeResult.manufacturerName} — {decodeResult.seriesName}
                </p>
              </div>

              {/* Token breakdown */}
              <div className="space-y-2">
                {decodeResult.tokens.map((token, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border p-3"
                    style={{
                      borderColor: token.unknown ? "color-mix(in srgb, #d32f2f 20%, transparent)" : "var(--border-color)",
                      backgroundColor: token.unknown ? "color-mix(in srgb, #d32f2f 5%, transparent)" : "var(--bg-primary)",
                    }}>
                    <div className="mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-xs font-mono font-semibold"
                      style={{
                        backgroundColor: token.unknown ? "color-mix(in srgb, #d32f2f 15%, transparent)" : "color-mix(in srgb, var(--accent) 12%, transparent)",
                        color: token.unknown ? "#d32f2f" : "var(--accent)",
                      }}>
                      {getFieldLabel(token.field)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {token.code}
                        {token.unknown && <span className="ml-2 text-xs" style={{ color: "#d32f2f" }}>(unrecognized)</span>}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {token.name}
                      </p>
                      {token.description && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
                          {token.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state for decode mode */}
          {!decodeResult && decodeAllResults.length === 0 && !decodeError && (
            <div className="rounded-xl border border-dashed p-8 text-center"
              style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-secondary)" }}>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-2xl"
                style={{ backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)" }}>
                🔍
              </div>
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Decode a Part Number</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                Paste a manufacturer part number and we'll break it down into its components with descriptions.
              </p>
              <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
                Try: QL81-SR-26D-306-Q71-IC, DND-26D, or KIL-SR-626
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Find Mode ── */}
      {tabMode === "find" && (
        <div className="space-y-4">
          {/* Search bar */}
          <div>
            <label className="label-text">Search Products</label>
            <input
              type="text"
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              placeholder="Search by name, series, brand, or category..."
              className="mt-1 w-full rounded-lg border px-4 py-3 text-sm transition-colors"
              style={{
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-primary)",
                borderColor: "var(--border-color)",
                minHeight: "48px",
                outline: "none",
              }}
            />
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap gap-2">
            {/* Category filter */}
            {filterOptions.categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setFindCategory(findCategory === cat.value ? "" : cat.value)}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: findCategory === cat.value ? "var(--accent)" : "color-mix(in srgb, var(--accent) 10%, transparent)",
                  color: findCategory === cat.value ? "#fff" : "var(--accent)",
                  cursor: "pointer",
                  minHeight: "32px",
                  border: "none",
                }}>
                {cat.label} ({cat.count})
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Grade filter */}
            {filterOptions.grades.map((g) => (
              <button
                key={g.value}
                onClick={() => setFindGrade(findGrade === g.value ? "" : g.value)}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: findGrade === g.value ? "var(--brass)" : "color-mix(in srgb, var(--brass) 10%, transparent)",
                  color: findGrade === g.value ? "#fff" : "var(--brass)",
                  cursor: "pointer",
                  minHeight: "32px",
                  border: "none",
                }}>
                {g.label} ({g.count})
              </button>
            ))}
            {/* Commercial/Residential toggle */}
            <button
              onClick={() => setFindCommercial(findCommercial === true ? undefined : true)}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: findCommercial === true ? "#1B2A4A" : "color-mix(in srgb, #1B2A4A 10%, transparent)",
                color: findCommercial === true ? "#fff" : "#1B2A4A",
                cursor: "pointer",
                minHeight: "32px",
                border: "none",
              }}>
              🏢 Commercial
            </button>
            <button
              onClick={() => setFindCommercial(findCommercial === false ? undefined : false)}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: findCommercial === false ? "#6B6B6B" : "color-mix(in srgb, #6B6B6B 10%, transparent)",
                color: findCommercial === false ? "#fff" : "#6B6B6B",
                cursor: "pointer",
                minHeight: "32px",
                border: "none",
              }}>
              🏠 Residential
            </button>
          </div>

          {/* Results count */}
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {findResults.length} product{findResults.length !== 1 ? "s" : ""} found
            {(findQuery || findCategory || findGrade || findCommercial !== undefined) && (
              <button
                onClick={() => {
                  setFindQuery("");
                  setFindCategory("");
                  setFindGrade("");
                  setFindCommercial(undefined);
                }}
                className="ml-2 underline"
                style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>
                Clear filters
              </button>
            )}
          </p>

          {/* Results list */}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {findResults.length === 0 && findQuery && (
              <p className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                No products found. Try adjusting your search or filters.
              </p>
            )}
            {findResults.map((result, idx) => {
              const words = result.manufacturerName.split(/[\s-]+/);
              const initials = words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : result.manufacturerName.slice(0, 2).toUpperCase();
              return (
                <div
                  key={`${result.manufacturerId}-${result.series}-${idx}`}
                  className="flex items-center gap-3 rounded-lg p-3 transition-colors"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    minHeight: "56px",
                  }}>
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)",
                      color: "var(--accent)",
                    }}>
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {result.productName}
                    </p>
                    <div className="mt-0.5 flex flex-wrap gap-1.5">
                      <span className="rounded px-1.5 py-0.5 text-xs" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                        {result.manufacturerName}
                      </span>
                      <span className="rounded px-1.5 py-0.5 text-xs" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                        {result.category}
                      </span>
                      {result.grade !== "—" && (
                        <span className="rounded px-1.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "color-mix(in srgb, var(--brass) 15%, transparent)", color: "var(--brass)" }}>
                          {result.grade === "residential" ? "Residential" : `Grade ${result.grade}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelection((prev) => ({
                        ...prev,
                        manufacturerId: result.manufacturerId,
                        manufacturerName: result.manufacturerName,
                        series: null,
                        pins: null,
                      }));
                      // Find and select the actual series object
                      const manuData = data.manufacturerFiles[result.manufacturerId];
                      if (manuData) {
                        const matched = manuData.products.find((p) => p.series === result.series);
                        if (matched) {
                          setTimeout(() => {
                            setSelection((prev) => ({
                              ...prev,
                              series: matched,
                              pins: null,
                            }));
                          }, 50);
                        }
                      }
                      setTabMode("build");
                    }}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: "var(--accent)",
                      color: "#fff",
                      cursor: "pointer",
                      minHeight: "36px",
                      border: "none",
                    }}>
                    Select
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Build Mode ── */}
      {tabMode === "build" && (
        <>
          <div className="mb-4">
        <SearchableSelect
          label="Brand"
          options={data.manufacturers}
          value={selection.manufacturerId ? { id: selection.manufacturerId, name: selection.manufacturerName ?? "" } : null}
          onChange={(opt) => updateSelection("manufacturerId", opt?.id ?? null)}
          placeholder="Select manufacturer..."
          displayKey="name"
          showCode={false}
        />
      </div>

          {/* Contact button — only when manufacturer is selected and has contact info */}
          {currentManufacturer?.contact && (
            <div className="mb-4">
              <button
                onClick={() => setContactOpen(true)}
                className="w-full rounded-lg px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--accent) 8%, transparent)",
                  color: "var(--accent)",
                  border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
                  cursor: "pointer",
                  minHeight: "44px",
                }}
              >
                <span>📞</span>
                <span>Contact {currentManufacturer.manufacturer}</span>
              </button>
            </div>
          )}

      {/* Only show further fields once manufacturer is selected */}
      {currentManufacturer && (
        <>
          {/* Progress + Clear All */}
          {selection.series && (
            <div className="mb-4 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                <div className="h-full rounded-full transition-[width] duration-300" style={{
                  width: `${fieldTotal > 0 ? (fieldSelected / fieldTotal) * 100 : 0}%`,
                  backgroundColor: fieldSelected === fieldTotal ? "var(--success)" : "var(--accent)",
                }} />
              </div>
              <span className="text-xs font-medium whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{fieldSelected}/{fieldTotal}</span>
              <button onClick={clearAll}
                className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--text-muted) 10%, transparent)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-color)",
                  cursor: "pointer",
                  minHeight: "36px",
                  whiteSpace: "nowrap",
                }}>
                Clear All
              </button>
            </div>
          )}

          {/* Part Number Display — always shown once series is selected and any field is filled */}
          {selection.series && (
            <>
              {partNumber ? (
                /* Complete part number */
                <section className="part-number-display mb-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--success)" }}>Complete Part Number</p>
                  <p className="part-number">{partNumber}</p>
                  {selection.series?.examples && (
                    <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                      Examples: {selection.series.examples.join(", ")}
                    </p>
                  )}
                  {user && (
                    <button onClick={() => {
                      const sp: SavedPart = {
                        partNumber: partNumber!,
                        manufacturer: currentManufacturer?.manufacturer ?? "",
                        series: selection.series?.name ?? "",
                        function: selection.options.function?.name ?? "",
                        finish: selection.options.finish?.name ?? "",
                        keyway: selection.options.keyway?.name ?? "",
                        pins: selection.pins?.toString() ?? "",
                        handing: selection.options.handing?.name ?? "",
                        backset: selection.options.backset?.name ?? "",
                        notes: "",
                      };
                      setSaveJobPart(sp);
                    }}
                      className="mt-3 w-full rounded-lg py-3 text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)",
                        color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
                        cursor: "pointer", minHeight: "48px",
                      }}>
                      + Save to Job
                    </button>
                  )}
                </section>
              ) : partialPartNumber ? (
                /* Partial part number */
                <section className="mb-3 rounded-lg border border-dashed p-4"
                  style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-secondary)" }}>
                  <p className="mb-1 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--brass)" }}>Partial Part Number</p>
                  <p className="part-number" style={{ opacity: 0.7 }}>{partialPartNumber}</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    Select all {fieldTotal} options to complete ({fieldTotal - fieldSelected} remaining)
                  </p>
                </section>
              ) : null}
            </>
          )}

          {/* Cross-brand conversion toast */}
          {conversionResult && (conversionResult.attempted > 0 || conversionResult.skipped.length > 0) && (
            <div className="mb-4 rounded-lg px-3 py-2.5 text-xs font-medium"
              style={{
                backgroundColor: "color-mix(in srgb, #2E7D32 10%, transparent)",
                color: "#2E7D32",
                border: "1px solid color-mix(in srgb, #2E7D32 25%, transparent)",
              }}>
              <span className="mr-1">✓</span>
              {Object.keys(conversionResult.converted).length} of {conversionResult.attempted + conversionResult.skipped.length} options carried over
              {conversionResult.skipped.length > 0 && (
                <span className="ml-1" style={{ opacity: 0.7 }}>
                  ({conversionResult.skipped.map((k) => getFieldLabel(k)).join(", ")} not converted)
                </span>
              )}
              <button
                onClick={() => setConversionResult(null)}
                className="ml-2 text-xs underline cursor-pointer"
                style={{ color: "inherit", background: "none", border: "none" }}>
                Dismiss
              </button>
            </div>
          )}

          {/* Proactive warnings */}
          {warnings.length > 0 && (
            <div className="mb-4 space-y-1">
              {warnings.map((w, i) => (
                <p key={i} className="rounded-lg px-3 py-2 text-xs font-medium"
                  style={{
                    backgroundColor: "color-mix(in srgb, #d32f2f 10%, transparent)",
                    color: "#d32f2f",
                    border: "1px solid color-mix(in srgb, #d32f2f 20%, transparent)",
                  }}>
                  ⚠ {w}
                </p>
              ))}
            </div>
          )}

          {/* Dropdown Fields */}
          <div className="space-y-4">
            {/* Series */}
            <SearchableSelect
              key="series"
              label="Series"
              options={currentManufacturer.products}
              value={selection.series ? { id: selection.series.series, name: selection.series.name, code: selection.series.series } : null}
              onChange={(opt) => updateSelection("series", opt as unknown as SeriesOption | null)}
              placeholder="Select product series..."
              displayKey="name"
              showCode={false}
            />

            {/* Dynamic option fields — only appear once series is selected */}
            {selection.series && activeFields.map((key) => {
              const options = selection.series?.options[key] ?? [];
              const currentValue = selection.options[key] ?? null;

              return (
                <SearchableSelect
                  key={key}
                  label={getFieldLabel(key)}
                  options={options}
                  value={currentValue}
                  onChange={(opt) => updateSelection(key, opt as SeriesOption | null)}
                  placeholder={getFieldPlaceholder(key)}
                  displayKey="name"
                />
              );
            })}
          </div>

          {/* Proprietary keyway note — info banner when selected keyway has a note */}
          {selection.options.keyway?.note && (
            <div className="mt-3 rounded-lg px-3 py-2.5 text-xs"
              style={{
                backgroundColor: "color-mix(in srgb, #1565C0 8%, transparent)",
                color: "#1565C0",
                border: "1px solid color-mix(in srgb, #1565C0 20%, transparent)",
              }}>
              <span className="mr-1.5">ℹ</span>
              {selection.options.keyway.note}
            </div>
          )}

          {/* Pin Count Selector — only show if the selected keyway has multiple pin options */}
          {selection.options.keyway?.availablePins && selection.options.keyway.availablePins.length > 0 && (
            <div className="mt-4">
              <label className="label-text">Pin Count</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {selection.options.keyway.availablePins.map((pin) => (
                  <button
                    key={pin}
                    onClick={() => updateSelection("pins", selection.pins === pin ? null : pin as unknown as SeriesOption)}
                    className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: selection.pins === pin
                        ? "var(--accent)"
                        : "color-mix(in srgb, var(--text-muted) 10%, transparent)",
                      color: selection.pins === pin ? "#fff" : "var(--text-primary)",
                      border: selection.pins === pin
                        ? "2px solid var(--accent)"
                        : "2px solid var(--border-color)",
                      cursor: "pointer",
                      minHeight: "44px",
                      minWidth: "60px",
                    }}
                    aria-pressed={selection.pins === pin}
                  >
                    {pin}-Pin
                  </button>
                ))}
                {selection.pins !== null && (
                  <button
                    onClick={() => setSelection((prev) => ({ ...prev, pins: null }))}
                    className="rounded-lg px-3 py-2 text-xs transition-colors"
                    style={{
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      minHeight: "44px",
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
              {selection.options.keyway.availablePins.length === 1 && (
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  Only {selection.options.keyway.availablePins[0]}-pin available for this keyway — auto-selected.
                </p>
              )}
            </div>
          )}

          {/* Series-Based Cross-References */}
          <CrossReferences
            families={seriesCrossRefFamilies}
            currentManufacturerId={selection.manufacturerId ?? ""}
            currentSeries={selection.series?.series ?? ""}
            manufacturerNames={manufacturerNameMap}
            onSelect={(mfrId, seriesCode) => {
              // Switch manufacturer and series
              if (mfrId !== selection.manufacturerId) {
                setSelection((prev) => ({
                  ...prev,
                  manufacturerId: mfrId,
                  manufacturerName: data.manufacturers.find((m) => m.id === mfrId)?.name ?? null,
                  series: null,
                  pins: null,
                }));
                // After manufacturer switch, we'd need to find and select the series
                // But since we're doing this async, we'll queue it
                setTimeout(() => {
                  const manuData = data.manufacturerFiles[mfrId];
                  if (manuData) {
                    const matchedSeries = manuData.products.find((p) => p.series === seriesCode);
                    if (matchedSeries) {
                      setSelection((prev) => ({
                        ...prev,
                        series: matchedSeries,
                        pins: null,
                      }));
                    }
                  }
                }, 50);
              } else {
                // Same manufacturer, just switch series
                const manuData = data.manufacturerFiles[mfrId];
                if (manuData) {
                  const matchedSeries = manuData.products.find((p) => p.series === seriesCode);
                  if (matchedSeries) {
                    setSelection((prev) => ({
                      ...prev,
                      series: matchedSeries,
                      pins: null,
                    }));
                  }
                }
              }
            }}
          />

          {/* Cross-References */}
          {crossRefs.length > 0 && (
            <section className="mt-6">
              <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Also available as</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {crossRefs.map((ref, idx) => {
                  const id = data.manufacturers.find((m) => m.name.toLowerCase().includes(ref.manufacturer.toLowerCase()))?.id;
                  const manu = id ? data.manufacturerFiles[id] : null;
                  const parts = ref.manufacturer.split(" ");
                  const initials = parts.length >= 2 ? parts[0][0] + parts[1][0] : ref.manufacturer.slice(0, 2).toUpperCase();
                  return (
                    <div key={idx} className="cross-ref-card">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                          style={{ backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)" }}>
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {ref.partNumber}
                          </p>
                          <a href={manu?.website ?? "#"} target="_blank" rel="noopener noreferrer"
                            className="truncate text-xs underline-offset-2 hover:underline" style={{ color: "var(--accent)" }}>
                            {ref.manufacturer}
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* Empty state (no manufacturer selected) */}
      {!currentManufacturer && (
        <div className="mb-6 rounded-xl border border-dashed p-8 text-center"
          style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-secondary)" }}>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-2xl"
            style={{ backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)" }}>
            🔐
          </div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Build a Part Number</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Start by selecting a manufacturer, then choose the product series and options.
          </p>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-10 border-t pt-5 text-center text-xs"
        style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}>
        LockBuilder &mdash; {t("Part Number Builder")} for Security Professionals
      </footer>

      {/* Auth Modal */}
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={saveSession}
        />
      )}

      {/* Settings Panel */}
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        setTheme={setTheme}
        mode={mode}
        setMode={setMode}
        lang={lang}
        setLang={setLang}
        t={t}
      />

      {/* Contact Modal */}
      {currentManufacturer?.contact && (
        <ContactModal
          open={contactOpen}
          onClose={() => setContactOpen(false)}
          brandName={currentManufacturer.manufacturer}
          contact={currentManufacturer.contact as ContactInfo}
        />
      )}

      {/* Save to Job Modal */}
      {saveJobPart && user && (
        <>
          <SaveToJobModal
            userId={user.id}
            part={saveJobPart}
            onClose={() => setSaveJobPart(null)}
            onSaved={() => {
              setSaveToast("✅ Saved to job!");
              setTimeout(() => setSaveToast(""), 3000);
            }}
          />
          {saveToast && (
            <div style={{
              position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
              zIndex: 999, backgroundColor: "var(--success)", color: "#fff",
              padding: "12px 24px", borderRadius: "10px", fontSize: "14px",
              fontWeight: 500, boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
              maxWidth: "90vw", textAlign: "center",
            }}>
              {saveToast}
            </div>
          )}
        </>
      )}
      </>)}
    </div>
  );
}