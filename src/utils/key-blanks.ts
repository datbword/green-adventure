import type { KeyBlank } from "~/types";

// ── Category Colors ──

export const CATEGORY_COLORS: Record<string, string> = {
  Residential: "#2563EB", // blue
  Commercial: "#16A34A",  // green
  Automotive: "#DC2626",  // red
  Padlock: "#EA580C",     // orange
  Cabinet: "#6B7280",     // gray
};

export const CATEGORY_ORDER = ["Residential", "Commercial", "Automotive", "Padlock", "Cabinet"];

// ── Search ──

/**
 * Normalize a string for search: lowercase, strip non-alphanumeric
 */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Search key blanks by query. Bidirectional — matches against Axxess #, ILCO #, fits, category, keyway.
 * Returns ranked results.
 */
export function searchKeyBlanks(query: string, blanks: KeyBlank[]): KeyBlank[] {
  if (!query.trim()) return blanks;

  const q = normalize(query);
  if (!q) return blanks;

  return blanks
    .map((blank) => {
      const normAxxess = normalize(blank.axxessNumber);
      const normIlco = normalize(blank.ilcoNumber);
      const normFits = normalize(blank.fits);
      const normCategory = normalize(blank.category);
      const normKeyway = normalize(blank.keyway);

      let score = 0;

      // Exact matches are highest
      if (normAxxess === q) score += 50;
      if (normIlco === q) score += 50;

      // Starts with
      if (normAxxess.startsWith(q)) score += 30;
      if (normIlco.startsWith(q)) score += 30;

      // Contains
      if (normAxxess.includes(q)) score += 15;
      if (normIlco.includes(q)) score += 15;
      if (normFits.includes(q)) score += 10;
      if (normCategory.includes(q)) score += 5;
      if (normKeyway.includes(q)) score += 5;

      return { blank, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.blank);
}

/**
 * Filter blanks by category (exact match, case-insensitive).
 */
export function filterByCategory(blanks: KeyBlank[], category: string): KeyBlank[] {
  if (!category) return blanks;
  return blanks.filter((b) => b.category.toLowerCase() === category.toLowerCase());
}

/**
 * Get category counts for filter chips.
 */
export function getCategoryCounts(blanks: KeyBlank[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const b of blanks) {
    counts[b.category] = (counts[b.category] || 0) + 1;
  }
  return counts;
}
