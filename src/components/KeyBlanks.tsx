import { useState, useMemo, useEffect, useRef } from "react";
import type { KeyBlank } from "~/types";
import {
  searchKeyBlanks,
  filterByCategory,
  getCategoryCounts,
  CATEGORY_COLORS,
  CATEGORY_ORDER,
} from "~/utils/key-blanks";

interface KeyBlanksProps {
  blanks: KeyBlank[] | null;
}

export function KeyBlanks({ blanks }: KeyBlanksProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Search + filter results
  const results = useMemo(() => {
    if (!blanks) return [];
    let filtered = activeCategory ? filterByCategory(blanks, activeCategory) : blanks;
    if (debouncedQuery) filtered = searchKeyBlanks(debouncedQuery, filtered);
    return filtered.slice(0, 50);
  }, [blanks, debouncedQuery, activeCategory]);

  // Category counts (from full dataset, not filtered)
  const categoryCounts = useMemo(() => (blanks ? getCategoryCounts(blanks) : {}), [blanks]);

  // Empty state
  if (!blanks) {
    return (
      <div className="space-y-4">
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: "var(--bg-secondary)" }}
        >
          <p className="text-lg mb-2" style={{ color: "var(--text-muted)" }}>
            📋
          </p>
          <p style={{ color: "var(--text-muted)" }}>
            Key blank data is being prepared by the data team.
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Check back soon — Axxess/Hillman ↔ ILCO cross-reference coming.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Search Key Blanks
        </label>
        <div className="mt-1 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type Axxess #, ILCO #, or description…"
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-base"
              style={{ color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none" }}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_ORDER.map((cat) => {
          const count = categoryCounts[cat] || 0;
          if (count === 0) return null;
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(isActive ? "" : cat)}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: isActive ? CATEGORY_COLORS[cat] || "var(--bg-tertiary)" : "var(--bg-tertiary)",
                color: isActive ? "#FFFFFF" : "var(--text-secondary)",
                border: isActive ? `1px solid ${CATEGORY_COLORS[cat]}` : "1px solid transparent",
                cursor: "pointer",
                minHeight: "32px",
              }}
            >
              {cat} <span style={{ opacity: 0.7 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Results */}
      {debouncedQuery || activeCategory ? (
        <div>
          <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
            {results.length} result{results.length !== 1 ? "s" : ""}
            {(debouncedQuery || activeCategory) && results.length > 0 && (
              <button
                onClick={() => { setQuery(""); setActiveCategory(""); }}
                className="ml-2 underline"
                style={{ color: "var(--accent)", cursor: "pointer", background: "none", border: "none" }}
              >
                Clear filters
              </button>
            )}
          </p>
          {results.length === 0 ? (
            <div
              className="rounded-xl p-6 text-center"
              style={{ backgroundColor: "var(--bg-secondary)" }}
            >
              <p style={{ color: "var(--text-muted)" }}>
                No key blanks found — try a different search.
              </p>
            </div>
          ) : (
            <div className="space-y-2" style={{ maxHeight: "60vh", overflowY: "auto" }}>
              {results.map((blank, i) => (
                <div
                  key={`${blank.axxessNumber}-${blank.ilcoNumber}-${i}`}
                  className="rounded-lg p-3 border"
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    borderColor: "var(--border-color)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* Axxess Number */}
                    <div className="flex-1 min-w-0">
                      <span className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                        {blank.axxessNumber}
                      </span>
                    </div>
                    {/* Arrow */}
                    <span className="text-lg flex-shrink-0" style={{ color: "var(--brass)", fontWeight: 700 }}>
                      →
                    </span>
                    {/* ILCO Number */}
                    <div className="flex-1 text-right min-w-0">
                      <span className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                        {blank.ilcoNumber}
                      </span>
                    </div>
                  </div>

                  {/* Fits description */}
                  {blank.fits && (
                    <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {blank.fits}
                    </p>
                  )}

                  {/* Category badge + keyway */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: `${CATEGORY_COLORS[blank.category] || "var(--bg-tertiary)"}20`,
                        color: CATEGORY_COLORS[blank.category] || "var(--text-secondary)",
                      }}
                    >
                      {blank.category}
                    </span>
                    {blank.keyway && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs"
                        style={{
                          backgroundColor: "var(--bg-tertiary)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {blank.keyway}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Initial empty state */
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: "var(--bg-secondary)" }}
        >
          <p className="text-3xl mb-3">🔑</p>
          <p style={{ color: "var(--text-primary)", fontWeight: 500 }}>
            Type a key blank number to search
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Cross-reference Axxess/Hillman and ILCO key blank numbers
          </p>
          {blanks.length > 0 && (
            <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
              {blanks.length} key blanks available
            </p>
          )}
        </div>
      )}
    </div>
  );
}
