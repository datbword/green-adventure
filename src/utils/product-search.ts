import type { ManufacturerData, ProductSeries } from "~/types";

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
      const searchText = normalize(
        `${product.name} ${product.series} ${product.category} ${data.manufacturer} ${product.description ?? ""}`,
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
