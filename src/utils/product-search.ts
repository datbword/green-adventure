import type { ManufacturerData, ProductSeries } from "~/types";
import { uusSearchText, parseLaymanQuery, matchLayman, type UusSynonymsFile } from "~/utils/uus";

export interface SearchFilters {
  query: string;
  category?: string;
  grade?: string;
  commercial?: boolean; // true = commercial only, false = residential, undefined = both
  manufacturer?: string;
}

export interface SearchResult {
  manufacturerId: string;
  manufacturerName: string;
  productName: string;
  series: string;
  category: string;
  grade: string;
  partNumberPattern: string;
  matchScore: number;
}

interface IndexedProduct {
  manufacturerId: string;
  manufacturerName: string;
  product: ProductSeries;
  searchText: string;
}

/** Normalize a string for search: lowercase, remove punctuation */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Extract grade from product name/description */
function extractGrade(product: ProductSeries): string {
  const text = normalize(product.name + " " + (product.description ?? ""));
  if (text.includes("grade 1") || text.includes("grade1")) return "1";
  if (text.includes("grade 2") || text.includes("grade2")) return "2";
  if (text.includes("grade 3") || text.includes("grade3")) return "3";
  // Infer from type
  if (product.type === "residential") return "residential";
  if (text.includes("heavy-duty") || text.includes("ansi/bhma grade 1")) return "1";
  if (text.includes("economy") || text.includes("light") || text.includes("value")) return "2";
  return "";
}

/** Check if product is commercial based on type field */
function isCommercial(product: ProductSeries): boolean {
  return product.type === "commercial";
}

/** Normalize category for filtering */
function normalizeCategory(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("cylindrical") || c.includes("knob") || c.includes("lever")) return "cylindrical";
  if (c.includes("mortise")) return "mortise";
  if (c.includes("exit") || c.includes("panic")) return "exit-device";
  if (c.includes("deadbolt") || c.includes("bolt")) return "deadbolt";
  if (c.includes("closer")) return "closer";
  if (c.includes("strike") || c.includes("maglock")) return "electric-strike";
  if (c.includes("electronic") || c.includes("smart") || c.includes("keypad")) return "electronic";
  if (c.includes("padlock")) return "padlock";
  if (c.includes("hinge") || c.includes("pivot")) return "hinge";
  if (c.includes("cylinder") || c.includes("core")) return "cylinder";
  if (c.includes("trim") || c.includes("plate") || c.includes("pull") || c.includes("kick")) return "trim";
  return "other";
}

/** Build search index from all manufacturer data */
export function buildSearchIndex(
  manufacturerFiles: Record<string, ManufacturerData>,
): IndexedProduct[] {
  const index: IndexedProduct[] = [];
  for (const [mfrId, data] of Object.entries(manufacturerFiles)) {
    for (const product of data.products) {
      // UUS search text comes from the RUNTIME derivation (canonical source).
      const searchText = normalize(
        `${product.name} ${product.series} ${product.category} ${data.manufacturer} ${product.description ?? ""} ${uusSearchText(product)}`,
      );
      index.push({
        manufacturerId: mfrId,
        manufacturerName: data.manufacturer,
        product,
        searchText,
      });
    }
  }
  return index;
}

/** Search products by query and filters, return ranked results */
export function searchProducts(
  index: IndexedProduct[],
  filters: SearchFilters,
  limit: number = 50,
): SearchResult[] {
  const queryTokens = filters.query ? normalize(filters.query).split(" ").filter(Boolean) : [];

  const results: SearchResult[] = [];

  for (const entry of index) {
    const product = entry.product;
    const normCategory = normalizeCategory(product.category ?? "");

    // Apply category filter
    if (filters.category && normCategory !== filters.category) continue;

    // Apply grade filter
    const productGrade = extractGrade(product);
    if (filters.grade && productGrade !== filters.grade) continue;

    // Apply commercial/residential filter
    if (filters.commercial === true && !isCommercial(product)) continue;
    if (filters.commercial === false && isCommercial(product)) continue;

    // Apply manufacturer filter
    if (filters.manufacturer && entry.manufacturerId !== filters.manufacturer) continue;

    // Compute match score
    let matchScore = 0;
    if (queryTokens.length > 0) {
      for (const token of queryTokens) {
        // Exact matches in series or product name score higher
        if (normalize(product.series).includes(token)) matchScore += 5;
        if (normalize(product.name).includes(token)) matchScore += 3;
        if (entry.searchText.includes(token)) matchScore += 1;
        // Manufacturer name match
        if (normalize(entry.manufacturerName).includes(token)) matchScore += 2;
      }
      // Skip if no match at all
      if (matchScore === 0) continue;
      // Phase B: layman-vocabulary boost — when EVERY query token matches through the
      // search text (UUS attributes/descriptions) and at least one token is NOT in the
      // product's own names (series/name/manufacturer), the match is an attribute-level
      // hit ("school lock" → classroom/Grade-1 levers, not any product named "* lock").
      if (queryTokens.length >= 2) {
        const allInText = queryTokens.every(t => entry.searchText.includes(t));
        const strong = (t: string) =>
          normalize(product.series).includes(t) || normalize(product.name).includes(t) || normalize(entry.manufacturerName).includes(t);
        const hasAttributeToken = queryTokens.some(t => !strong(t));
        if (allInText && hasAttributeToken) {
          // A query matched ENTIRELY through attribute vocabulary ("satin chrome") is the
          // strongest layman signal — it must outrank products that merely share a name token.
          const allAttribute = queryTokens.every(t => !strong(t));
          matchScore += allAttribute ? 40 : 15;
        }
      }
    } else {
      // No query — all filtered products pass with base score
      matchScore = 1;
    }

    results.push({
      manufacturerId: entry.manufacturerId,
      manufacturerName: entry.manufacturerName,
      productName: product.name,
      series: product.series,
      category: normCategory,
      grade: productGrade || "—",
      partNumberPattern: product.partNumberPattern,
      matchScore,
    });
  }

  // Sort by score descending
  results.sort((a, b) => b.matchScore - a.matchScore);

  return results.slice(0, limit);
}

/** Get all available filter values */
export function getFilterOptions(index: IndexedProduct[]): {
  categories: { value: string; label: string; count: number }[];
  grades: { value: string; label: string; count: number }[];
} {
  const catCount: Record<string, number> = {};
  const gradeCount: Record<string, number> = {};

  for (const entry of index) {
    const cat = normalizeCategory(entry.product.category ?? "");
    catCount[cat] = (catCount[cat] || 0) + 1;

    const g = extractGrade(entry.product);
    if (g) gradeCount[g] = (gradeCount[g] || 0) + 1;
  }

  const categoryLabels: Record<string, string> = {
    cylindrical: "Cylindrical",
    mortise: "Mortise",
    "exit-device": "Exit Device",
    deadbolt: "Deadbolt",
    closer: "Door Closer",
    "electric-strike": "Electric Strike",
    electronic: "Electronic",
    padlock: "Padlock",
    hinge: "Hinge",
    cylinder: "Cylinder",
    trim: "Trim",
    other: "Other",
  };

  const gradeLabels: Record<string, string> = {
    "1": "Grade 1",
    "2": "Grade 2",
    "3": "Grade 3",
    residential: "Residential",
  };

  return {
    categories: Object.entries(catCount)
      .sort(([, a], [, b]) => b - a)
      .map(([value, count]) => ({ value, label: categoryLabels[value] || value, count })),
    grades: Object.entries(gradeCount)
      .sort(([, a], [, b]) => b - a)
      .map(([value, count]) => ({ value, label: gradeLabels[value] || value, count })),
  };
}

/** Layman (plain-English) search: map the query through uus-synonyms.json → UUS attributes,
 *  match against the RUNTIME deriveUus() attributes of every indexed product, rank by number of
 *  matched attribute groups (specific groups weighted first), and return chips per result. */
export interface LaymanSearchResult extends SearchResult {
  matchedAttributes: string[];
  laymanScore: number;
}
export function laymanSearch(
  index: IndexedProduct[],
  query: string,
  synonyms: UusSynonymsFile | null,
  limit: number = 30,
): LaymanSearchResult[] {
  const q = parseLaymanQuery(query, synonyms);
  const out: LaymanSearchResult[] = [];
  for (const entry of index) {
    const m = matchLayman(entry.product, q);
    if (m.count === 0) continue;
    const specific = m.matched.filter(x => /^(Function|Finish|Style|Cylinder|Feature):/.test(x)).length;
    const generic = m.count - specific;
    // Name-phrase bonus: a product whose own name/series contains a matched multi-word layman
    // phrase ("smart deadbolt") is more relevant than one matching only through attributes —
    // keeps literal smart deadbolts above plain electronic locks on the same score.
    const nameText = normalize(`${entry.product.name} ${entry.product.series}`);
    const nameBonus = (q.matchedPhrases ?? []).filter(p => p.includes(" ") && nameText.includes(p)).length * 2;
    out.push({
      manufacturerId: entry.manufacturerId,
      manufacturerName: entry.manufacturerName,
      productName: entry.product.name,
      series: entry.product.series,
      category: normalizeCategory(entry.product.category ?? ""),
      grade: extractGrade(entry.product) || "—",
      partNumberPattern: entry.product.partNumberPattern,
      matchScore: m.count,
      matchedAttributes: m.matched,
      laymanScore: specific * 3 + generic + nameBonus,
    });
  }
  out.sort((a, b) => b.laymanScore - a.laymanScore || b.matchScore - a.matchScore);
  return out.slice(0, limit);
}
