import { lazy, Suspense, useState, useMemo, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile, readdir } from "node:fs/promises";
import { SearchableSelect } from "~/components/SearchableSelect";
import { AuthModal } from "~/components/AuthModal";
import { UserMenu } from "~/components/UserMenu";
import { SaveToJobModal } from "~/components/SaveToJobModal";
import { SettingsPanel } from "~/components/SettingsPanel";
const SecurityAudit = lazy(() => import("~/components/SecurityAudit").then(module => ({ default: module.SecurityAudit })));
import { ContactModal, type ContactInfo } from "~/components/ContactModal";
import { buildPartNumber, buildPartialPartNumber, findCrossReferences, isComplete, getActiveFields, getFieldCounts, getFieldLabel, getFieldPlaceholder } from "~/utils/part-builder";
import { decodePartNumber, tryPartialDecode, generateSuggestions, type DecodeResult, type Suggestion } from "~/utils/part-decoder";
import { translateDecoded } from "~/utils/uus";
import type { ConversionResult } from "~/utils/option-converter";
import { useVisualMode } from "~/hooks/useVisualMode";
import { useAuth } from "~/hooks/useAuth";
import { I18nProvider, useI18n } from "~/i18n/context";
import type { ManufacturerData, ManufacturerOption, ProductSeries, SeriesOption, Selection, DataCache, CrossRefFamily, KeyBlank } from "~/types";
import { CrossReferences } from "~/components/CrossReferences";
import { buildSearchIndex, searchProducts, laymanSearch, getFilterOptions, type SearchFilters, type SearchResult } from "~/utils/product-search";
import { UUS_CATEGORIES, UUS_GRADES, UUS_FUNCTIONS, UUS_DESIGN_STYLES, UUS_CYLINDER_TYPES, type UusSynonymsFile } from "~/utils/uus";
import { findUusCandidates, mapUusSelection, type UusBuildSelection } from "~/utils/uus-build";
import { autoCorrectSelection, getAvailableValues, getConstraintForbiddenValues, validateUusMapping, evaluateState, extractConstraintState, UUS_FIELDS, type ConstraintTable, type AutoCorrection, type ConstraintState } from "~/utils/uus-constraints";
import type { SavedPart } from "~/utils/jobs";
import { LOCK_FUNCTIONS } from "~/utils/lock-functions";
import { HANDING_TYPES } from "~/utils/door-handing";

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
    "manufacturers.json", "part-formats.json", "key-blanks.json", "ilco-directory.json",
    "uus-attributes.json", "uus-dictionary.json", "uus-synonyms.json", "constraint-table.json",
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

  // Phase C: centralized Constraint_Table (owner schema; live rows only where data-provable)
  let constraintTable: unknown = null;
  if (allFiles.includes("constraint-table.json")) {
    try {
      constraintTable = await loadJson<unknown>(`${base}/constraint-table.json`);
    } catch {
      constraintTable = null;
    }
  }

  return { manufacturers, manufacturerFiles, crossReferences, constraintTable };
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

// ── Client-side data loaders ──
// NOTE: These MUST be defined inside Home() to prevent Vite code-splitting
// them into separate chunks that never load on tab switch.

function Home() {
  const data = Route.useLoaderData();
  const { mode, setMode } = useVisualMode();
  const { t, lang, setLang } = useI18n();
  const { user, showAuth, setShowAuth, saveSession, clearSession } = useAuth();
  const [saveJobPart, setSaveJobPart] = useState<SavedPart | null>(null);
  const [saveToast, setSaveToast] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [buildNotes, setBuildNotes] = useState("");
  const [showResourcesBanner, setShowResourcesBanner] = useState(true);
  // Decode mode state (declared before tab-specific effects)
  const [tabMode, setTabMode] = useState<"build" | "decode" | "find" | "resources" | "audit">("build");

  // Key Blanks data (fetched client-side)
  const [keyBlanksData, setKeyBlanksData] = useState<KeyBlank[] | null>(null);
  const [keyBlanksFilter, setKeyBlanksFilter] = useState("");
  useEffect(() => {
    if (tabMode !== "resources" || keyBlanksData !== null) return;
    fetch("/data/key-blanks.json").then(r => r.json()).then(d => setKeyBlanksData(d.blanks)).catch(() => {});
  }, [tabMode, keyBlanksData]);
  // Load decoded result into the Build tab
  function openInBuilder(result: DecodeResult) {
    const mfrFile = data.manufacturerFiles[result.manufacturerId];
    if (!mfrFile) return;
    const series = mfrFile.products.find((p) => p.series === result.series);
    if (!series) return;

    // Map decoded tokens to selection options
    const opts: Record<string, SeriesOption | null> = {};
    for (const token of result.tokens) {
      const fieldOptions = series.options?.[token.field];
      if (fieldOptions) {
        const matched = fieldOptions.find((o) => o.code === token.code);
        if (matched) opts[token.field] = matched;
      }
    }

    setSelection({
      manufacturerId: result.manufacturerId,
      manufacturerName: result.manufacturerName,
      series,
      pins: null,
      options: opts,
    });
    setTabMode("build");
    // Scroll to top for mobile users
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Decode mode state
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
  // Phase B refined: layman search (plain-English) via uus-synonyms.json
  const [synonymsData, setSynonymsData] = useState<UusSynonymsFile | null>(null);
  const [laymanForce, setLaymanForce] = useState(false);
  useEffect(() => {
    fetch("/data/uus-synonyms.json").then(r => r.json()).then(d => setSynonymsData(d as UusSynonymsFile)).catch(() => {});
  }, []);

  const defaultSelection: Selection = {
    manufacturerId: null,
    manufacturerName: null,
    series: null,
    pins: null,
    options: {},
  };

  const [selection, setSelection] = useState<Selection>({ ...defaultSelection });
  // Phase B refined: UUS Simple build
  const [buildModeSimple, setBuildModeSimple] = useState(false);
  const [uusSel, setUusSel] = useState<UusBuildSelection>({});
  const [uusMissing, setUusMissing] = useState<{ field: string; label: string }[]>([]);
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);
  // Phase C: Cross-Brand Validation Loop — toasts + hard-block banner
  const [constraintToasts, setConstraintToasts] = useState<AutoCorrection[]>([]);
  const [constraintBlocked, setConstraintBlocked] = useState<string | null>(null);
  const pushToasts = (cs: AutoCorrection[]) => {
    if (cs.length === 0) return;
    setConstraintToasts((prev) => [...prev, ...cs]);
    setTimeout(() => setConstraintToasts((prev) => prev.filter((c) => !cs.includes(c))), 6000);
  };

  const [constraintTable, setConstraintTable] = useState<ConstraintTable | null>(
    (data as DataCache).constraintTable as ConstraintTable | null,
  );
  // DEV-ONLY: ?uusTest=1 merges public/data/constraint-table.test.json (synthetic ACTIVE rows) into the
  // in-memory table to demonstrate toasts/interlocking/hard-block in a browser walk-through.
  // Never shipped: production serves the shipped table (0 active rows) unless the flag is present.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("uusTest")) return;
    fetch("/data/constraint-table.test.json")
      .then((r) => r.json())
      .then((t: ConstraintTable) => {
        if (t?.rows?.length) {
          setConstraintTable((prev) => ({ rows: [...(prev?.rows ?? []), ...t.rows] }));
        }
      })
      .catch(() => {});
  }, []);

  // Phase C interlocking: for each UUS field, which values remain possible given the other selections?
  const uusFieldDomain: Record<string, string[]> = {
    category: Object.keys(UUS_CATEGORIES).filter((k) => !["other", "key-blank", "key-machine", "software"].includes(k)),
    grade: Object.keys(UUS_GRADES),
    function: ["passage", "privacy", "entrance", "office", "storeroom", "classroom", "classroom-security", "communicating", "dummy", "deadbolt"],
    style: ["straight", "curved", "flat", "ornate", "knob"],
    finish: ["brass", "bronze", "chrome", "stainless", "nickel", "black", "gold", "aluminum"],
    cylinder: ["conventional", "sf-ic", "lf-ic", "keyed-removable", "electronic"],
  };
  const uusAvailable = useMemo(() => {
    const out: Record<string, Set<string>> = {};
    for (const field of UUS_FIELDS) {
      out[field] = getAvailableValues(data.manufacturerFiles, uusSel, field, uusFieldDomain[field] ?? []);
    }
    return out;
  }, [data.manufacturerFiles, uusSel]);

  // Phase C (owner spec): EXTRACT — current build selection mapped to UUS attribute values
  // (UUS fields + product option fields). Brand-scoped constraint rows fire only when a brand is known.
  const constraintState = useMemo<ConstraintState>(() => {
    return extractConstraintState(uusSel, selection.manufacturerId, selection.options);
  }, [uusSel, selection.manufacturerId, selection.options]);

  // Dynamic interlocking by ACTIVE constraint rows: candidate values whose selection would trigger a
  // correction or a hard block are grayed out. Recomputes on every change. (0 active rows today → empty.)
  const constraintForbidden = useMemo(() => {
    const out: Record<string, Set<string>> = {};
    for (const field of UUS_FIELDS) {
      out[field] = getConstraintForbiddenValues(constraintTable, constraintState, field, uusFieldDomain[field] ?? []);
    }
    return out;
  }, [constraintTable, constraintState]);

  /** Combined interlocking for a UUS value: unavailable when no product supports it (data-derived)
   *  OR when an ACTIVE constraint row would fire a correction/block if it were selected. */
  const uusValueUnavailable = (field: string, k: string): boolean =>
    !(uusAvailable[field]?.has(k) ?? true) || (constraintForbidden[field]?.has(k) ?? false);

  /** UUS field change handler with the Validation Loop (owner architecture):
   *  1. data-derived auto-correct (preserves the user's just-changed field — e.g. upgrade grade to
   *     keep the option they picked),
   *  2. evaluateState over the Constraint_Table (EXTRACT → EVALUATE → EXECUTE, bounded loop),
   *  3. apply UUS-field corrections to the form state, toast every correction,
   *  4. hard block when blocked:true — no part number can be generated. */
  const setUusField = (field: keyof UusBuildSelection, value: string) => {
    setConstraintBlocked(null);
    let next: UusBuildSelection = { ...uusSel, [field]: value || undefined };
    const dataCorrection = autoCorrectSelection(data.manufacturerFiles, next, field as never);
    next = dataCorrection.selection;
    const state = extractConstraintState(next, selection.manufacturerId, selection.options);
    const loop = evaluateState(state, constraintTable);
    const loopCorrections: AutoCorrection[] = loop.corrections.map((c) => ({ field: c.field, from: c.from, to: c.to, message: c.message }));
    for (const c of loop.corrections) {
      if ((UUS_FIELDS as readonly string[]).includes(c.field)) {
        next = { ...next, [c.field]: c.to || undefined };
      }
    }
    setUusSel(next);
    pushToasts([...dataCorrection.corrections, ...loopCorrections]);
    if (dataCorrection.blocked) {
      setConstraintBlocked(dataCorrection.blockMessage ?? "That combination isn't available — try fewer attributes.");
    } else if (loop.blocked) {
      setConstraintBlocked(loop.messages.join(" ") || "Those options can't be combined — try changing your selection.");
    }
  };

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
    // Pins is a top-level selection field, not an option
    if (key === "pins") {
      setSelection((prev) => ({
        ...prev,
        pins: value as unknown as number | null,
      }));
    } else {
      setSelection((prev) => ({
        ...prev,
        options: { ...prev.options, [key]: value },
      }));
    }
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

  // Build the full part number (only when complete) — HARD BLOCKED when a constraint row says blocked:true
  const partNumber = useMemo(() => {
    if (constraintBlocked) return null; // Phase C: do not emit a part number for an invalid combination
    if (!selection.series || !isComplete(selection)) return null;
    return buildPartNumber(selection, selection.series);
  }, [selection, constraintBlocked]);

  // Build the partial part number (always, even when incomplete)
  const partialPartNumber = useMemo(() => {
    if (constraintBlocked) return null; // Phase C hard block — do not emit a partial string either
    if (!selection.series) return null;
    // Only show partial if at least one field is selected
    if (fieldSelected === 0) return null;
    return buildPartialPartNumber(selection, selection.series);
  }, [selection, fieldSelected, constraintBlocked]);

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
  const uusCandidates = useMemo(() => findUusCandidates(data.manufacturerFiles, uusSel), [data.manufacturerFiles, uusSel]);

  // Auto-detect: queries with no digits and no filters active are treated as plain-English
  // (layman) searches; the manual toggle forces either mode. Part-number/series queries stay on the direct path.
  const partNumberLike = /[0-9]/.test(findQuery);
  const useLayman = laymanForce || (findQuery.trim().length > 0 && !partNumberLike && !findCategory && !findGrade && findCommercial === undefined);
  const findResults = useMemo(() => {
    if (useLayman) return laymanSearch(searchIndex, findQuery, synonymsData, 40);
    const filters: SearchFilters = {
      query: findQuery,
      category: findCategory || undefined,
      grade: findGrade || undefined,
      commercial: findCommercial,
    };
    return searchProducts(searchIndex, filters, 40);
  }, [searchIndex, findQuery, findCategory, findGrade, findCommercial, useLayman, synonymsData]);

  // Copy-to-clipboard button
  function CopyButton({ text, label }: { text: string; label?: string }) {
    const [copied, setCopied] = useState(false);
    return (
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Fallback for older browsers
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        }}
        className="rounded-md px-2 py-1 text-xs font-medium transition-colors"
        style={{
          backgroundColor: copied ? "var(--success)" : "color-mix(in srgb, var(--text-muted) 10%, transparent)",
          color: copied ? "#fff" : "var(--text-muted)",
          border: copied ? "1px solid var(--success)" : "1px solid color-mix(in srgb, var(--text-muted) 15%, transparent)",
          cursor: "pointer",
          minHeight: "28px",
          whiteSpace: "nowrap",
        }}
        aria-label={`Copy ${label || text}`}
      >
        {copied ? "✓ Copied" : (label || "📋 Copy")}
      </button>
    );
  }

  // Lock function cheat-sheet popup
  function FunctionHelp({ options }: { options: SeriesOption[] }) {
    const [open, setOpen] = useState(false);
    if (options.length <= 1) return null;
    return (
      <span style={{ position: "relative", display: "inline-block", marginLeft: "4px" }}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label="Function help"
          title="What do these functions mean?"
          style={{
            width: "18px", height: "18px", borderRadius: "50%",
            border: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)",
            fontSize: "11px", fontWeight: "bold", cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: 0, lineHeight: 1, minHeight: "18px",
          }}
        >?</button>
        {open && (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 49 }}
              onClick={() => setOpen(false)}
            />
            <div
              className="rounded-lg border p-4 shadow-lg"
              style={{
                position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
                zIndex: 50, width: "320px", maxWidth: "90vw",
                backgroundColor: "var(--bg-primary)", borderColor: "var(--border-color)",
                maxHeight: "300px", overflowY: "auto",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>Lock Functions</p>
                <button onClick={() => setOpen(false)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "14px" }}>✕</button>
              </div>
              <div className="space-y-2">
                {options.map((fn) => (
                  <div key={fn.code} style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "6px" }}>
                    <p className="text-xs font-semibold" style={{ color: "var(--accent)" }}>{fn.code} — {fn.name}</p>
                    {fn.description && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{fn.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </span>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 sm:py-8">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between sm:mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold text-white shadow-sm"
            style={{ backgroundColor: mode === "high-contrast" ? "#000" : mode === "dark" ? "#1F1F1F" : mode === "calm" ? "#6B6B6B" : "#1B2A4A" }}>
            LB
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl" style={{ color: "var(--text-primary)" }}>{t("LockBuilder")}</h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{tabMode === "build" ? t("Part Number Builder") : tabMode === "decode" ? t("Part Number Decoder") : tabMode === "find" ? t("Find Products") : tabMode === "audit" ? "Security Audit" : "Resources"}</p>
            <a href="https://22822198b50f564bb257f71390e5cd13.ctonew.app" target="_blank" rel="noopener noreferrer"
              className="text-xs" style={{ color: "var(--accent)" }}>
              🌐 Open in browser
            </a>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
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
        <button
          onClick={() => setTabMode("resources")}
          className="flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors"
          style={{
            backgroundColor: tabMode === "resources" ? "var(--bg-primary)" : "transparent",
            color: tabMode === "resources" ? "var(--text-primary)" : "var(--text-muted)",
            boxShadow: tabMode === "resources" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            cursor: "pointer", minHeight: "44px", border: "none",
          }}>
          📚 Resources
        </button>
        <button onClick={() => setTabMode("audit")} className="flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors" style={{ backgroundColor: tabMode === "audit" ? "var(--bg-primary)" : "transparent", color: tabMode === "audit" ? "var(--text-primary)" : "var(--text-muted)", boxShadow: tabMode === "audit" ? "0 1px 3px rgba(0,0,0,0.1)" : "none", cursor: "pointer", minHeight: "44px", border: "none" }}>🛡️ Audit</button>
      </div>

      {/* ── Audit Mode ── */}
      {tabMode === "audit" && (
        <Suspense fallback={<p className="text-center py-8" style={{ color: "var(--text-muted)" }}>Loading audit...</p>}>
          <SecurityAudit />
        </Suspense>
      )}

      {/* ── Resources Mode ── */}
      {tabMode === "resources" && (
        <div className="space-y-3">
          {/* Web Version Banner */}
          {showResourcesBanner && (
            <div className="relative flex flex-col items-center gap-3 rounded-xl border p-6 text-center" style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--accent)", borderWidth: "1.5px" }}>
              <span className="text-2xl">💡</span>
              <div>
                <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Best viewed in your browser</p>
                <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>PDFs open best in a full web browser with Ctrl+F search and zoom controls.</p>
                <a href="https://22822198b50f564bb257f71390e5cd13.ctonew.app" target="_blank" rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm font-medium" style={{ color: "var(--accent)" }}>
                  Open web version ↗
                </a>
              </div>
              <button onClick={() => setShowResourcesBanner(false)}
                className="absolute top-2 right-2 text-sm leading-none" style={{ color: "var(--text-muted)", padding: "4px 8px", minWidth: "32px", minHeight: "32px", background: "none", border: "none", cursor: "pointer" }}
                aria-label="Dismiss">
                ✕
              </button>
            </div>
          )}
          {/* Axxess Key Reference */}
          <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border-color)" }}>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>🔑 Axxess Key Reference — Axxess/Hillman ↔ ILCO/EZ</h2>
            <input type="text" value={keyBlanksFilter} onChange={(e) => setKeyBlanksFilter(e.target.value)} placeholder="Search by Axxess #, ILCO #, or description..." className="mt-3 w-full rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border-color)", minHeight: "48px" }} />
            {keyBlanksData == null ? <p className="text-center py-8" style={{ color: "var(--text-muted)" }}>Loading key blanks...</p> : (() => { const filtered = keyBlanksFilter.trim() ? keyBlanksData.filter((b: any) => (b.axxessNumber || "").toLowerCase().includes(keyBlanksFilter.toLowerCase()) || (b.ilcoNumber || "").toLowerCase().includes(keyBlanksFilter.toLowerCase())) : keyBlanksData; return <><p className="mt-2" style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{filtered.length} of {keyBlanksData.length} blanks</p>{filtered.slice(0, 100).map((b: any, i: number) => <div key={i} className="mt-1 flex items-center justify-between rounded-lg px-4 py-2 text-sm" style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-color)" }}><span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{b.axxessNumber}</span><span style={{ color: "var(--text-muted)" }}>=</span><span style={{ fontFamily: "monospace", color: "var(--accent)" }}>{b.ilcoNumber}</span></div>)}</>; })()}
          </div>
          {/* Lock Functions */}
          <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border-color)" }}><h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>🔒 Lock Functions</h2><p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Common commercial lock function codes at a glance.</p><div className="mt-3 space-y-1">{LOCK_FUNCTIONS.slice(0, 6).map(fn => <div key={fn.code} className="flex justify-between text-sm"><span style={{ color: "var(--accent)" }}>{fn.code}</span><span style={{ color: "var(--text-primary)" }}>{fn.name}</span></div>)}</div><a href="/functions" className="mt-3 inline-block text-sm font-medium" style={{ color: "var(--accent)" }}>View all functions →</a></div>
          {/* Door Handing */}
          <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border-color)" }}><h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>🚪 Door Handing</h2><p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Quick reference for standard door handing.</p><div className="mt-3 grid grid-cols-2 gap-2">{HANDING_TYPES.map(h => <div key={h.code} className="rounded border p-2 text-sm" style={{ borderColor: "var(--border-color)" }}><strong style={{ color: "var(--accent)" }}>{h.code}</strong><span className="ml-2" style={{ color: "var(--text-primary)" }}>{h.name}</span></div>)}</div><a href="/handing" className="mt-3 inline-block text-sm font-medium" style={{ color: "var(--accent)" }}>Full handing reference →</a></div>
          {/* Keyboard Shortcuts Card */}
          <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border-color)" }}>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>⌨ Keyboard Shortcuts</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>For searching and navigating PDFs in your browser</p>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {[
                ["Find / Search", "Ctrl + F"],
                ["Find next", "Ctrl + G"],
                ["Find previous", "Ctrl + Shift + G"],
                ["Print", "Ctrl + P"],
                ["Save / Download", "Ctrl + S"],
                ["Zoom in", "Ctrl + +"],
                ["Zoom out", "Ctrl + −"],
                ["Reset zoom", "Ctrl + 0"],
                ["Scroll down", "Space"],
                ["Scroll up", "Shift + Space"],
                ["First page", "Home"],
                ["Last page", "End"],
              ].map(([action, shortcut]) => (
                <div key={action} className="flex justify-between gap-2 py-0.5" style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <span style={{ color: "var(--text-muted)" }}>{action}</span>
                  <kbd className="rounded px-1.5 py-px text-xs" style={{
                    backgroundColor: "var(--bg-primary)",
                    color: "var(--accent)",
                    border: "1px solid var(--border-color)",
                    fontFamily: "monospace",
                    whiteSpace: "nowrap",
                  }}>{shortcut.replace(/Ctrl/g, "⌃")}</kbd>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
              Mac: use <kbd className="rounded px-1 text-xs" style={{ fontFamily: "monospace", backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>⌘ Cmd</kbd> instead of <kbd className="rounded px-1 text-xs" style={{ fontFamily: "monospace", backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>Ctrl</kbd>
            </p>
          </div>
          {/* ILCO 13th Edition Key Blank Directory */}
          <a href="https://drive.google.com/file/d/1OXDuQUPXXV7UKtmzIGF2wOyrDklu1PQN/view?usp=drive_link" target="_blank" rel="noopener noreferrer"
            className="block rounded-xl border p-4 transition-colors" style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border-color)" }}>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>ILCO 13th Edition Key Blank Directory</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Complete key blank reference — all manufacturers (hosted externally)</p>
            <span className="mt-3 inline-block text-sm font-medium" style={{ color: "var(--accent)" }}>Open directory ↗</span>
          </a>
        </div>
      )}

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
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--success)" }}>Decoded Part Number</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openInBuilder(decodeResult)}
                      className="rounded-md px-2 py-1 text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: "var(--accent)",
                        color: "#fff",
                        border: "1px solid var(--accent)",
                        cursor: "pointer",
                        minHeight: "28px",
                        whiteSpace: "nowrap",
                      }}
                    >🔨 Open in Builder</button>
                    <CopyButton text={decodeResult.partNumber} />
                  </div>
                </div>
                <p className="mt-1 font-mono text-lg font-bold" style={{ color: "var(--text-primary)" }}>{decodeResult.partNumber}</p>
                <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
                  {decodeResult.manufacturerName} — {decodeResult.seriesName}
                </p>
              </div>
              {/* Plain-English translation (UUS) */}
              {(() => {
                const uusLines = translateDecoded(decodeResult, data.manufacturerFiles);
                if (uusLines.length === 0) return null;
                return (
                  <div className="mb-4 rounded-lg border p-3" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-secondary)" }}>
                    <p className="mb-1 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      In plain English
                    </p>
                    <ul className="space-y-0.5">
                      {uusLines.map((line, i) => (
                        <li key={i} className="text-sm" style={{ color: "var(--text-primary)" }}>{line}</li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

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
              placeholder={useLayman ? "Try: heavy duty school lock, satin chrome storeroom lever..." : "Search by name, series, brand, or category..."}
              className="mt-1 w-full rounded-lg border px-4 py-3 text-sm transition-colors"
              style={{
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-primary)",
                borderColor: "var(--border-color)",
                minHeight: "48px",
                outline: "none",
              }}
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => setLaymanForce(!laymanForce)}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: useLayman ? "var(--accent)" : "color-mix(in srgb, var(--accent) 10%, transparent)",
                  color: useLayman ? "#fff" : "var(--accent)",
                  cursor: "pointer",
                  minHeight: "32px",
                  border: "none",
                }}>
                {useLayman ? "🔎 Plain English search" : "🔎 Plain English search (off)"}
              </button>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {useLayman ? `Matching by meaning — try "school lock" or "panic bar".` : "Type a part number / series for exact find, or toggle plain-English search."}
              </span>
            </div>
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
                      {(result as { matchedAttributes?: string[] }).matchedAttributes?.map((m) => (
                        <span key={m} className="rounded px-1.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}>
                          {m.replace(/^[A-Za-z]+: /, "")}
                        </span>
                      ))}
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
          {/* Build mode toggle */}
          <div className="mb-3 flex gap-2">
            <button
              onClick={() => setBuildModeSimple(false)}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
              style={{
                backgroundColor: buildModeSimple ? "color-mix(in srgb, var(--text-muted) 10%, transparent)" : "var(--accent)",
                color: buildModeSimple ? "var(--text-secondary)" : "#fff",
                cursor: "pointer", minHeight: "44px", border: "none",
              }}>
              Standard build
            </button>
            <button
              onClick={() => setBuildModeSimple(true)}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
              style={{
                backgroundColor: buildModeSimple ? "var(--accent)" : "color-mix(in srgb, var(--text-muted) 10%, transparent)",
                color: buildModeSimple ? "#fff" : "var(--text-secondary)",
                cursor: "pointer", minHeight: "44px", border: "none",
              }}>
              ✨ Simple build
            </button>
          </div>
          {buildModeSimple && (
            <div className="mb-4 rounded-lg border p-3" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-secondary)" }}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Describe the hardware — we'll map it to a real part number
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div>
                  <label className="text-xs" style={{ color: "var(--text-muted)" }}>Category</label>
                  <select value={uusSel.category ?? ""} onChange={(e) => setUusField("category", e.target.value)}
                    className="w-full rounded-lg border px-2 py-2 text-sm" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
                    <option value="">Any</option>
                    {Object.entries(UUS_CATEGORIES).filter(([k]) => !["other", "key-blank", "key-machine", "software"].includes(k)).map(([k, label]) => (
                      <option key={k} value={k} disabled={uusSel.category !== k && uusValueUnavailable("category", k)}>{label}{uusSel.category !== k && uusValueUnavailable("category", k) ? " — n/a" : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs" style={{ color: "var(--text-muted)" }}>Grade</label>
                  <select value={uusSel.grade ?? ""} onChange={(e) => setUusField("grade", e.target.value)}
                    className="w-full rounded-lg border px-2 py-2 text-sm" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
                    <option value="">Any</option>
                    {Object.entries(UUS_GRADES).map(([k, label]) => (
                      <option key={k} value={k} disabled={uusSel.grade !== k && uusValueUnavailable("grade", k)}>{label}{uusSel.grade !== k && uusValueUnavailable("grade", k) ? " — n/a" : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs" style={{ color: "var(--text-muted)" }}>Function</label>
                  <select value={uusSel.function ?? ""} onChange={(e) => setUusField("function", e.target.value)}
                    className="w-full rounded-lg border px-2 py-2 text-sm" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
                    <option value="">Any</option>
                    {["passage", "privacy", "entrance", "office", "storeroom", "classroom", "classroom-security", "communicating", "dummy", "deadbolt"].map((k) => (
                      <option key={k} value={k} disabled={uusSel.function !== k && uusValueUnavailable("function", k)}>{UUS_FUNCTIONS[k]}{uusSel.function !== k && uusValueUnavailable("function", k) ? " — n/a" : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs" style={{ color: "var(--text-muted)" }}>Style</label>
                  <select value={uusSel.style ?? ""} onChange={(e) => setUusField("style", e.target.value)}
                    className="w-full rounded-lg border px-2 py-2 text-sm" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
                    <option value="">Any</option>
                    {["straight", "curved", "flat", "ornate", "knob"].map((k) => (
                      <option key={k} value={k} disabled={uusSel.style !== k && uusValueUnavailable("style", k)}>{UUS_DESIGN_STYLES[k]}{uusSel.style !== k && uusValueUnavailable("style", k) ? " — n/a" : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs" style={{ color: "var(--text-muted)" }}>Finish</label>
                  <select value={uusSel.finish ?? ""} onChange={(e) => setUusField("finish", e.target.value)}
                    className="w-full rounded-lg border px-2 py-2 text-sm" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
                    <option value="">Any</option>
                    {["brass", "bronze", "chrome", "stainless", "nickel", "black", "gold", "aluminum"].map((k) => (
                      <option key={k} value={k} disabled={uusSel.finish !== k && uusValueUnavailable("finish", k)}>{k[0].toUpperCase() + k.slice(1)}{uusSel.finish !== k && uusValueUnavailable("finish", k) ? " — n/a" : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs" style={{ color: "var(--text-muted)" }}>Cylinder</label>
                  <select value={uusSel.cylinder ?? ""} onChange={(e) => setUusField("cylinder", e.target.value)}
                    className="w-full rounded-lg border px-2 py-2 text-sm" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }}>
                    <option value="">Any</option>
                    {["conventional", "sf-ic", "lf-ic", "keyed-removable", "electronic"].map((k) => (
                      <option key={k} value={k} disabled={uusSel.cylinder !== k && uusValueUnavailable("cylinder", k)}>{UUS_CYLINDER_TYPES[k]}{uusSel.cylinder !== k && uusValueUnavailable("cylinder", k) ? " — n/a" : ""}</option>
                    ))}
                  </select>
                </div>
              </div>
              {constraintBlocked && (
                <div className="mt-3 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "#fca5a5", backgroundColor: "#fef2f2", color: "#991b1b" }}>
                  <span className="font-semibold">⚠️ {constraintBlocked}</span>
                </div>
              )}
              {Object.values(uusSel).some(Boolean) && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    {uusCandidates.length} matching series across all brands — pick one to map to its real options
                  </p>
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {uusCandidates.slice(0, 12).map((cand) => (
                      <button
                        key={`${cand.manufacturerId}-${cand.product.series}`}
                        onClick={() => {
                          const validation = validateUusMapping(cand, uusSel);
                          setConstraintBlocked(null);
                          if (validation.blocked) {
                            setConstraintBlocked(validation.blockMessage ?? "That series can't satisfy those choices.");
                            setUusMissing(validation.missing);
                            return; // HARD BLOCK — do not populate the builder with an invalid mapping
                          }
                          // Phase C: brand/series switch runs the full Validation Loop (owner spec) —
                          // EXTRACT with the candidate's brand → EVALUATE → EXECUTE corrections → hard block.
                          const pickSel: UusBuildSelection = validation.corrections.length > 0
                            ? { ...uusSel, ...validation.corrections.reduce((acc, c) => ({ ...acc, [c.field]: c.to }), {}) }
                            : uusSel;
                          const pickState = extractConstraintState(pickSel, cand.manufacturerId);
                          const loop = evaluateState(pickState, constraintTable);
                          const loopCorrections: AutoCorrection[] = loop.corrections.map((c) => ({ field: c.field, from: c.from, to: c.to, message: c.message }));
                          for (const c of loop.corrections) {
                            if ((UUS_FIELDS as readonly string[]).includes(c.field)) {
                              pickSel[c.field] = c.to || undefined;
                            }
                          }
                          setUusSel(pickSel);
                          pushToasts([...validation.corrections, ...loopCorrections]);
                          if (loop.blocked) {
                            setConstraintBlocked(loop.messages.join(" ") || "Those options can't be combined on this series.");
                            return; // HARD BLOCK — do not populate the builder
                          }
                          const mapping = mapUusSelection(cand.product, pickSel);
                          setUusMissing(mapping.missing);
                          setSelection({
                            manufacturerId: cand.manufacturerId,
                            manufacturerName: cand.manufacturerName,
                            series: cand.product,
                            pins: null,
                            options: mapping.optionObjects,
                          });
                        }}
                        className="w-full rounded-lg px-3 py-2 text-left text-xs transition-colors"
                        style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-color)", cursor: "pointer", minHeight: "40px" }}>
                        <span className="font-medium" style={{ color: "var(--text-primary)" }}>{cand.manufacturerName} — {cand.product.name}</span>
                        <span className="ml-2" style={{ color: "var(--accent)" }}>{cand.matched.join(" · ")}</span>
                      </button>
                    ))}
                    {uusCandidates.length === 0 && (
                      <p className="py-2 text-xs" style={{ color: "var(--text-muted)" }}>No series match those choices — try fewer attributes.</p>
                    )}
                  </div>
                </div>
              )}
              {uusMissing.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium" style={{ color: "#92400e" }}>Not offered on the selected series:</p>
                  {uusMissing.map((m) => (
                    <span key={`${m.field}-${m.label}`} className="mr-1.5 inline-block rounded px-1.5 py-0.5 text-xs" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>
                      {m.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
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
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--success)" }}>Complete Part Number</p>
                    <CopyButton text={partNumber} />
                  </div>
                  <p className="part-number">{partNumber}</p>
                  {selection.series?.examples && (
                    <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                      Examples: {selection.series.examples.join(", ")}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
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
                          notes: buildNotes,
                        };
                        setSaveJobPart(sp);
                      }}
                        className="flex-1 rounded-lg py-3 text-sm font-medium transition-colors"
                        style={{
                          backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)",
                          color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
                          cursor: "pointer", minHeight: "48px",
                        }}>
                        + Save to Job
                      </button>
                    )}
                    <button onClick={() => {
                      const lines: string[] = [];
                      lines.push("══════════════════════════════════");
                      lines.push("         LOCK BUILD CARD");
                      lines.push("══════════════════════════════════");
                      lines.push("");
                      lines.push(`Part Number: ${partNumber}`);
                      lines.push(`Brand:       ${currentManufacturer?.manufacturer ?? ""}`);
                      lines.push(`Series:      ${selection.series?.name ?? ""}`);
                      if (selection.options.function) lines.push(`Function:    ${selection.options.function.code} — ${selection.options.function.name}`);
                      if (selection.options.finish) lines.push(`Finish:      ${selection.options.finish.code} — ${selection.options.finish.name}`);
                      if (selection.options.keyway) lines.push(`Keyway:      ${selection.options.keyway.code} — ${selection.options.keyway.name}`);
                      if (selection.options.handing) lines.push(`Handing:     ${selection.options.handing.code} — ${selection.options.handing.name}`);
                      if (selection.options.backset) lines.push(`Backset:     ${selection.options.backset.code} — ${selection.options.backset.name}`);
                      if (selection.pins) lines.push(`Pins:        ${selection.pins}`);
                      if (buildNotes.trim()) {
                        lines.push("");
                        lines.push("Notes:");
                        lines.push(buildNotes.trim());
                      }
                      lines.push("");
                      lines.push("══════════════════════════════════");
                      lines.push(`Printed: ${new Date().toLocaleDateString()}`);
                      lines.push("Generated by LockBuilder");
                      const text = lines.join("\n");

                      const w = window.open("", "_blank", "width=500,height=600");
                      if (w) {
                        w.document.write(`<pre style="font-family: monospace; font-size: 14px; line-height: 1.6; padding: 20px; white-space: pre-wrap;">${text.replace(/</g, "<").replace(/>/g, ">")}</pre><script>window.print();<\/script>`);
                        w.document.close();
                      }
                    }}
                      className="rounded-lg px-4 py-3 text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: "var(--bg-secondary)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border-color)",
                        cursor: "pointer",
                        minHeight: "48px",
                      }}>
                      🖨️ Print Card
                    </button>
                  </div>
                </section>
              ) : partialPartNumber ? (
                /* Partial part number */
                <section className="mb-3 rounded-lg border border-dashed p-4"
                  style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-secondary)" }}>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--brass)" }}>Partial Part Number</p>
                    <CopyButton text={partialPartNumber!} />
                  </div>
                  <p className="part-number" style={{ opacity: 0.7 }}>{partialPartNumber}</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    Select all {fieldTotal} options to complete ({fieldTotal - fieldSelected} remaining)
                  </p>
                </section>
              ) : null}
            </>
          )}

          {/* Quick Notes — always visible when series is selected */}
          {selection.series && (
            <div className="mb-4">
              <label className="label-text">Quick Notes</label>
              <textarea
                value={buildNotes}
                onChange={(e) => setBuildNotes(e.target.value)}
                placeholder="Door is 1-3/4 thick, existing strike is ANSI, customer wants keyed-alike..."
                rows={2}
                className="mt-1 w-full rounded-lg px-4 py-3 text-sm transition-colors resize-none"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                  outline: "none",
                  minHeight: "60px",
                  fontFamily: "inherit",
                }}
                onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--border-color)"; }}
              />
            </div>
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
                  highlightEmpty={!!selection.series && !currentValue}
                  labelExtra={key === "function" ? <FunctionHelp options={options} /> : undefined}
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

          {/* Pin Count Selector — only show when keyway supports multiple pin counts */}
          {selection.options.keyway?.availablePins && selection.options.keyway.availablePins.length > 1 && (
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
                          <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                            {ref.manufacturer}{ref.series ? ` — ${ref.series}` : ""}
                          </p>
                        </div>
                        {id && (
                          <button
                            onClick={() => {
                              const file = data.manufacturerFiles[id];
                              const matchingSeries = file?.products.find(
                                (p) => ref.series && p.series.toLowerCase().includes(ref.series.toLowerCase())
                              );
                              setSelection({
                                manufacturerId: id,
                                manufacturerName: data.manufacturers.find((m) => m.id === id)?.name ?? null,
                                series: matchingSeries ?? null,
                                pins: null,
                                options: {},
                              });
                              setTabMode("build");
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                            style={{
                              backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)",
                              color: "var(--accent)",
                              border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
                              cursor: "pointer",
                              minHeight: "28px",
                            }}>
                            View
                          </button>
                        )}
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
        </>
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
          {constraintToasts.length > 0 && (
            <div style={{
              position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)",
              zIndex: 998, display: "flex", flexDirection: "column", gap: "6px",
              width: "min(90vw, 420px)",
            }}>
              {constraintToasts.map((c, i) => (
                <div key={`${c.field}-${c.to}-${i}`} style={{
                  backgroundColor: "var(--accent)", color: "#fff",
                  padding: "10px 16px", borderRadius: "10px", fontSize: "13px",
                  fontWeight: 500, boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                  textAlign: "center", lineHeight: 1.35,
                }}>
                  🔁 {c.message}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}