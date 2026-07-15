import { useState, useMemo, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile, readdir } from "node:fs/promises";
import { SearchableSelect } from "~/components/SearchableSelect";
import { AuthModal } from "~/components/AuthModal";
import { UserMenu } from "~/components/UserMenu";
import { SaveToJobModal } from "~/components/SaveToJobModal";
import { buildPartNumber, buildPartialPartNumber, findCrossReferences, isComplete, getActiveFields, getFieldCounts } from "~/utils/part-builder";
import { useVisualMode } from "~/hooks/useVisualMode";
import { useAuth } from "~/hooks/useAuth";
import type { ManufacturerData, ManufacturerOption, ProductSeries, SeriesOption, Selection, DataCache } from "~/types";
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

  return { manufacturers, manufacturerFiles };
});

export const Route = createFileRoute("/")({
  loader: () => loadAllData(),
  component: Home,
});

// ── Visual Mode ──

const MODE_ICONS: Record<string, string> = { normal: "☀️", dark: "🌙", "high-contrast": "🔲", calm: "🌀" };
const MODE_LABELS: Record<string, string> = { normal: "Light mode", dark: "Dark mode", "high-contrast": "High contrast", calm: "Calm mode" };

function Home() {
  const data = Route.useLoaderData();
  const { mode, cycleMode } = useVisualMode();
  const { user, showAuth, setShowAuth, saveSession, clearSession } = useAuth();
  const [saveJobPart, setSaveJobPart] = useState<SavedPart | null>(null);
  const [saveToast, setSaveToast] = useState("");

  const defaultSelection: Selection = {
    manufacturerId: null,
    manufacturerName: null,
    series: null,
    function: null,
    finish: null,
    keyway: null,
    pins: null,
    handing: null,
    backset: null,
    style: null,
    grade: null,
  };

  const [selection, setSelection] = useState<Selection>({ ...defaultSelection });

  const updateSelection = (key: keyof Selection, value: unknown) => {
    // When manufacturer changes, reset all downstream selections
    if (key === "manufacturerId") {
      setSelection({
        ...defaultSelection,
        manufacturerId: value as string | null,
        manufacturerName: value ? data.manufacturers.find((m) => m.id === value)?.name ?? null : null,
      });
      return;
    }
    setSelection((prev) => ({ ...prev, [key]: value }));
  };

  const clearAll = () => {
    setSelection({ ...defaultSelection });
  };

  // Auto-select pin count when keyway has only one available pin option
  useEffect(() => {
    if (selection.keyway?.availablePins && selection.keyway.availablePins.length === 1) {
      const onlyPin = selection.keyway.availablePins[0];
      if (selection.pins !== onlyPin) {
        setSelection((prev) => ({ ...prev, pins: onlyPin }));
      }
    }
  }, [selection.keyway]);

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

  // Cross-references from the manufacturer data
  const crossRefs = useMemo(() => {
    if (!partNumber || !currentManufacturer) return [];
    return findCrossReferences(partNumber, currentManufacturer.crossReferences);
  }, [partNumber, currentManufacturer]);

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
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl" style={{ color: "var(--text-primary)" }}>LockBuilder</h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Part Number Builder</p>
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
              <span className="text-base">🔑</span>
            </button>
          )}
          <button className="mode-toggle-btn" onClick={cycleMode} title={MODE_LABELS[mode]}
            aria-label={`Visual mode: ${MODE_LABELS[mode]}. Click to change.`}>
            <span className="text-base">{MODE_ICONS[mode]}</span>
          </button>
        </div>
      </header>

      {/* Brand / Manufacturer Selector */}
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
                        function: selection.function?.name ?? "",
                        finish: selection.finish?.name ?? "",
                        keyway: selection.keyway?.name ?? "",
                        pins: selection.pins?.toString() ?? "",
                        handing: selection.handing?.name ?? "",
                        backset: selection.backset?.name ?? "",
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

          {/* Dropdown Fields */}
          <div className="space-y-4">
            {/* Series */}
            <SearchableSelect
              key="series"
              label="Series"
              options={currentManufacturer.products}
              value={selection.series}
              onChange={(opt) => updateSelection("series", opt as ProductSeries | null)}
              placeholder="Select product series..."
              displayKey="name"
              showCode={false}
            />

            {/* Other fields only appear once series is selected */}
            {selection.series && activeFields.map((key) => {
              const fieldDef = FIELD_DEFS[key];
              if (!fieldDef) return null;
              const options = fieldDef.getOptions(selection.series!) ?? [];
              const currentValue = selection[key] as SeriesOption | null;

              return (
                <SearchableSelect
                  key={key}
                  label={fieldDef.label}
                  options={options}
                  value={currentValue}
                  onChange={(opt) => updateSelection(key, opt as SeriesOption | null)}
                  placeholder={fieldDef.placeholder}
                  displayKey="name"
                />
              );
            })}
          </div>

          {/* Pin Count Selector — only show if the selected keyway has multiple pin options */}
          {selection.keyway?.availablePins && selection.keyway.availablePins.length > 0 && (
            <div className="mt-4">
              <label className="label-text">Pin Count</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {selection.keyway.availablePins.map((pin) => (
                  <button
                    key={pin}
                    onClick={() => updateSelection("pins", selection.pins === pin ? null : pin)}
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
                    onClick={() => updateSelection("pins", null)}
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
              {selection.keyway.availablePins.length === 1 && (
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  Only {selection.keyway.availablePins[0]}-pin available for this keyway — auto-selected.
                </p>
              )}
            </div>
          )}

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
        LockBuilder &mdash; Professional Part Number Builder for Security Professionals
      </footer>

      {/* Auth Modal */}
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={saveSession}
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
    </div>
  );
}

// ── Field Definitions ──

const FIELD_DEFS: Record<string, { label: string; placeholder: string; getOptions: (series: ProductSeries) => SeriesOption[] }> = {
  function: {
    label: "Function",
    placeholder: "Select lock function...",
    getOptions: (s) => s.options.function ?? [],
  },
  style: {
    label: "Style",
    placeholder: "Select style/design...",
    getOptions: (s) => s.options.style ?? [],
  },
  grade: {
    label: "Grade",
    placeholder: "Select grade...",
    getOptions: (s) => s.options.grade ?? [],
  },
  finish: {
    label: "Finish",
    placeholder: "Select finish...",
    getOptions: (s) => s.options.finish ?? [],
  },
  keyway: {
    label: "Keyway",
    placeholder: "Select keyway...",
    getOptions: (s) => s.options.keyway ?? [],
  },
  handing: {
    label: "Handing",
    placeholder: "Select handing...",
    getOptions: (s) => s.options.handing ?? [],
  },
  backset: {
    label: "Backset",
    placeholder: "Select backset...",
    getOptions: (s) => s.options.backset ?? [],
  },
};