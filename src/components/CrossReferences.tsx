import { useState } from "react";

export interface CrossRefProduct {
  manufacturerId: string;
  manufacturerName: string;
  productName: string;
  series: string;
}

export interface CrossRefFamily {
  id: string;
  name: string;
  description: string;
  products: { manufacturerId: string; productName: string; series: string }[];
}

interface CrossReferencesProps {
  families: CrossRefFamily[];
  currentManufacturerId: string;
  currentSeries: string;
  manufacturerNames: Record<string, string>;
  onSelect: (manufacturerId: string, series: string) => void;
}

export function CrossReferences({
  families,
  currentManufacturerId,
  currentSeries,
  manufacturerNames,
  onSelect,
}: CrossReferencesProps) {
  const [expanded, setExpanded] = useState(false);

  if (families.length === 0) return null;

  // For each family, find the current product and list others
  const relevantFamilies = families.map((family) => {
    const currentProduct = family.products.find(
      (p) => p.manufacturerId === currentManufacturerId && p.series === currentSeries
    );
    const equivalents = family.products.filter(
      (p) => !(p.manufacturerId === currentManufacturerId && p.series === currentSeries)
    );
    return { family, currentProduct, equivalents };
  }).filter((f) => f.currentProduct);

  if (relevantFamilies.length === 0) return null;

  return (
    <section className="mt-4" style={{ minWidth: 0 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors"
        style={{
          backgroundColor: "color-mix(in srgb, var(--accent) 8%, transparent)",
          color: "var(--accent)",
          cursor: "pointer",
          minHeight: "44px",
          border: "1px solid color-mix(in srgb, var(--accent) 15%, transparent)",
        }}
      >
        <span>🔗 Cross-References{!expanded ? ` (${relevantFamilies.length} equivalence${relevantFamilies.length > 1 ? "s" : ""})` : ""}</span>
        <span style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", fontSize: "0.7rem" }}>
          ▼
        </span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-3" style={{ minWidth: 0 }}>
          {relevantFamilies.map(({ family, equivalents }) => (
            <div
              key={family.id}
              className="rounded-lg p-3"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                {family.name}
              </p>
              <p className="mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
                {family.description}
              </p>
              <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                {equivalents.map((eq, idx) => {
                  const mfrName = manufacturerNames[eq.manufacturerId] || eq.manufacturerId;
                  // Get initials for the icon
                  const words = mfrName.split(/[\s-]+/);
                  const initials = words.length >= 2
                    ? (words[0][0] + words[1][0]).toUpperCase()
                    : mfrName.slice(0, 2).toUpperCase();
                  return (
                    <button
                      key={`${eq.manufacturerId}-${eq.series}-${idx}`}
                      onClick={() => onSelect(eq.manufacturerId, eq.series)}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors"
                      style={{
                        backgroundColor: "var(--bg-secondary)",
                        border: "1px solid var(--border-color)",
                        cursor: "pointer",
                        minHeight: "44px",
                      }}
                      title={`Switch to ${mfrName} ${eq.productName}`}
                    >
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                        style={{
                          backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)",
                          color: "var(--accent)",
                        }}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                          {mfrName}
                        </p>
                        <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                          {eq.productName}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
