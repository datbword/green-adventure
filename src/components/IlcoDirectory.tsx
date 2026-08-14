import { useState, useMemo, useEffect, useRef } from "react";
import type { IlcoBlank, IlcoDirectoryData, IlcoCrossRefs } from "~/types";
import {
  searchIlcoDirectory,
  getUserTags,
  addTag,
  removeTag,
  type IlcoSearchResult,
} from "~/utils/ilco-directory";

interface IlcoDirectoryProps {
  data: IlcoDirectoryData | null;
}

const XREF_CONFIG: { key: keyof IlcoCrossRefs; label: string }[] = [
  { key: "original", label: "Orig" },
  { key: "axxess", label: "Axxess" },
  { key: "jma", label: "JMA" },
  { key: "silca", label: "Silca" },
  { key: "jet", label: "Jet" },
  { key: "taylor", label: "Taylor" },
  { key: "curtis", label: "Curtis" },
  { key: "dominion", label: "Dominion" },
  { key: "esp", label: "ESP" },
];

interface XrefRow {
  label: string;
  code: string;
  id: string | null;
}

function buildXrefRows(
  xref: IlcoCrossRefs,
  _handleCopy: (text: string) => void,
  _copied: string | null,
): XrefRow[] {
  const rows: XrefRow[] = [];
  for (const cfg of XREF_CONFIG) {
    const val = xref[cfg.key] as { code: string | null; id: string | null } | undefined;
    if (val?.code) {
      rows.push({ label: cfg.label, code: val.code, id: val.id });
    }
  }
  return rows;
}

/**
 * Copy text to clipboard with fallback.
 */
function copyToClipboard(text: string): boolean {
  try {
    navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

/** Color for branch role */
function roleColor(role?: string): string {
  switch (role) {
    case "master": return "var(--brass)";
    case "pass-through": return "#16A34A";
    default: return "var(--text-primary)";
  }
}

function roleEmoji(role?: string): string {
  switch (role) {
    case "master": return "👑";
    case "pass-through": return "↔️";
    default: return "🔑";
  }
}

export function IlcoDirectory({ data }: IlcoDirectoryProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [userTags, setUserTags] = useState<Record<string, string[]>>({});
  const [addingTagFor, setAddingTagFor] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Load user tags
  useEffect(() => {
    setUserTags(getUserTags());
  }, []);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Search results
  const results = useMemo<IlcoSearchResult[]>(() => {
    if (!data || !debouncedQuery) return [];
    return searchIlcoDirectory(debouncedQuery, data, userTags);
  }, [data, debouncedQuery, userTags]);

  // Families sorted
  const families = useMemo(() => {
    if (!data) return [];
    return [...data.families].sort((a, b) => a.familyName.localeCompare(b.familyName));
  }, [data]);

  // Copy handler
  const handleCopy = (text: string) => {
    if (copyToClipboard(text)) {
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    }
  };

  // Tag handlers
  const handleAddTag = (ilcoNumber: string) => {
    if (tagInput.trim()) {
      const updated = addTag(ilcoNumber, tagInput.trim());
      setUserTags(updated);
      setTagInput("");
      setAddingTagFor(null);
    }
  };

  const handleRemoveTag = (ilcoNumber: string, tag: string) => {
    const updated = removeTag(ilcoNumber, tag);
    setUserTags(updated);
  };

  // Empty state — no data
  if (!data) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl p-8 text-center" style={{ backgroundColor: "var(--bg-secondary)" }}>
          <p className="text-lg mb-2" style={{ color: "var(--text-muted)" }}>📖</p>
          <p style={{ color: "var(--text-muted)" }}>ILCO directory data is being prepared by the data team.</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Check back soon.</p>
        </div>
      </div>
    );
  }

  /** Render a single blank card */
  const renderBlankCard = (blank: IlcoBlank, familyName: string, showFamily: boolean) => {
    const role = blank.branchRole;
    const blankTags = [
      ...(blank.tags || []),
      ...(userTags[blank.ilcoNumber] || []),
    ];
    const xref = blank.crossReferences || {};

    return (
      <div
        key={blank.ilcoNumber}
        className="rounded-lg border p-3 mb-2"
        style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-color)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: roleColor(role) }}>{roleEmoji(role)}</span>
          <span className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
            {blank.ilcoNumber}
          </span>
          {showFamily && (
            <span className="text-xs rounded px-2 py-0.5" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
              {familyName}
            </span>
          )}
        </div>

        {/* Role info */}
        {role === "master" && blank.masterFor && blank.masterFor.length > 0 && (
          <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
            Cuts: {blank.masterFor.join(", ")}
          </p>
        )}
        {role === "standard" && blank.cutFrom && (
          <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
            Cut from: {blank.cutFrom}
          </p>
        )}
        {role === "pass-through" && blank.isPassThrough && (
          <p className="text-xs mb-1" style={{ color: "#16A34A" }}>
            Pass-through
          </p>
        )}

        {/* ILCO Catalog ID */}
        {xref.ilcoCatalogId && (
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Catalog #: {xref.ilcoCatalogId}
          </p>
        )}

        {/* Cross-references */}
        {(
          xref.original?.code ||
          xref.axxess?.code ||
          xref.jma?.code ||
          xref.silca?.code ||
          xref.jet?.code ||
          xref.taylor?.code ||
          xref.curtis?.code ||
          xref.dominion?.code ||
          xref.esp?.code
        ) ? (
          <div className="mt-2 rounded-lg p-2" style={{ backgroundColor: "var(--bg-secondary)" }}>
            <p className="text-xs mb-1.5 font-medium" style={{ color: "var(--text-muted)" }}>
              ── Cross-References ──
            </p>
            {buildXrefRows(xref, handleCopy, copied).map((row, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs py-0.5">
                <span style={{ color: "var(--text-muted)", minWidth: "48px" }}>{row.label}:</span>
                <span className="font-mono" style={{ color: "var(--text-primary)" }}>
                  {row.code}
                  {row.id && <span style={{ color: "var(--text-muted)" }}> ({row.id})</span>}
                </span>
                <button
                  onClick={() => handleCopy(row.code)}
                  className="text-xs cursor-pointer ml-auto"
                  style={{
                    color: copied === row.code ? "var(--accent)" : "var(--text-muted)",
                    background: "none",
                    border: "none",
                  }}
                  title={`Copy ${row.code}`}
                >
                  {copied === row.code ? "✓" : "📋"}
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {/* ILCO Number copy */}
        <div className="mt-1">
          <button
            onClick={() => handleCopy(blank.ilcoNumber)}
            className="text-xs underline cursor-pointer"
            style={{ color: copied === blank.ilcoNumber ? "var(--accent)" : "var(--text-muted)", background: "none", border: "none" }}
          >
            {copied === blank.ilcoNumber ? "✓ Copied!" : "Copy ILCO #"}
          </button>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-1 mt-2">
          {blankTags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleRemoveTag(blank.ilcoNumber, tag)}
              className="rounded-full px-2 py-0.5 text-xs cursor-pointer"
              style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "none" }}
              title="Click to remove"
            >
              {tag} ✕
            </button>
          ))}
          {addingTagFor === blank.ilcoNumber ? (
            <form
              onSubmit={(e) => { e.preventDefault(); handleAddTag(blank.ilcoNumber); }}
              className="flex items-center gap-1"
            >
              <input
                autoFocus
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                className="rounded-full px-2 py-0.5 text-xs w-24"
                placeholder="Tag name…"
                style={{
                  backgroundColor: "var(--bg-primary)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                }}
              />
              <button
                type="submit"
                className="rounded-full px-2 py-0.5 text-xs cursor-pointer"
                style={{ backgroundColor: "var(--accent)", color: "#fff", border: "none" }}
              >
                ✓
              </button>
            </form>
          ) : (
            <button
              onClick={() => { setAddingTagFor(blank.ilcoNumber); setTagInput(""); }}
              className="rounded-full px-2 py-0.5 text-xs cursor-pointer"
              style={{ backgroundColor: "transparent", color: "var(--text-muted)", border: "1px dashed var(--border-color)" }}
            >
              + tag
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div>
        <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Search ILCO Directory
        </label>
        <div className="mt-1 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ILCO #, brand, keyway, or tag…"
            className="w-full rounded-lg border px-3 py-3 pr-10 text-sm"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderColor: "var(--border-color)",
              color: "var(--text-primary)",
              minHeight: "44px",
            }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-base cursor-pointer"
              style={{ color: "var(--text-muted)", background: "none", border: "none" }}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Search Results */}
      {debouncedQuery && (
        <div>
          <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
            {results.length} result{results.length !== 1 ? "s" : ""}
            <button
              onClick={() => setQuery("")}
              className="ml-2 underline cursor-pointer"
              style={{ color: "var(--accent)", background: "none", border: "none" }}
            >
              Clear
            </button>
          </p>
          {results.length === 0 ? (
            <div className="rounded-xl p-6 text-center" style={{ backgroundColor: "var(--bg-secondary)" }}>
              <p style={{ color: "var(--text-muted)" }}>
                No matches — try a different search term. You can also add your own tag names.
              </p>
            </div>
          ) : (
            <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
              {results.map((r) => renderBlankCard(r.blank, r.familyName, true))}
            </div>
          )}
        </div>
      )}

      {/* Family Browser (when not searching) */}
      {!debouncedQuery && (
        <div>
          <h3 className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
            Key Families ({families.length})
          </h3>
          {families.map((family) => (
            <details key={family.family} className="mb-3 group">
              <summary
                className="rounded-lg px-4 py-3 cursor-pointer flex items-center justify-between"
                style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)", minHeight: "44px", listStyle: "none" }}
              >
                <span className="font-semibold text-sm">{family.familyName}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {family.blanks.length} blanks ▾
                </span>
              </summary>
              <div className="mt-2 pl-2">
                {family.blanks.map((blank) => renderBlankCard(blank, family.familyName, false))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
