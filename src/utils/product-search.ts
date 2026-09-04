import type { ManufacturerData, ProductSeries } from "~/types";
import {
  uusSearchText,
  parseLaymanQuery,
  matchLayman,
  deriveUus,
  categoryFormMatches,
  isLeverForm,
  UUS_CYLINDER_TYPES,
  type UusSynonymsFile,
  type UusLaymanAttributes,
  type UusAttributes,
} from "~/utils/uus";

export interface SearchFilters {
  query: string;
  category?: string;
  grade?: string;
  commercial?: boolean; // true = commercial only, false = residential, undefined = both
  manufacturer?: string;
  /** uus-synonyms.json phrase table — required for the brand-anchored progressive search */
  synonyms?: UusSynonymsFile | null;
  /** true → brand-anchored progressive search (every token filters, AND; anchored brands rank first) */
  semantic?: boolean;
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
  /** semantic search: matched attribute chips ("Function: Storeroom", "Finish: Satin Chrome (626)", ...) */
  matchedAttributes?: string[];
  /** semantic search: true when the result's brand was anchored by the query */
  brandAnchored?: boolean;
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
        `${product.name} ${product.series} ${product.category} ${data.manufacturer} ${product.description ?? ""} ${(product.examples ?? []).join(" ")} ${uusSearchText(product)}`,
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
  // Brand-anchored progressive search (owner directive 2026-08-13): enabled when the Find tab passes
  // the synonym phrase table + semantic flag. The legacy scoring path below is preserved unchanged so
  // callers without the synonym table (verify suites, direct find) behave exactly as before.
  if (filters.semantic && filters.synonyms) return semanticSearch(index, filters, limit);

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

// ─────────────────── Brand-anchored progressive search (owner directive 2026-08-13) ───────────────────
// Replaces fuzzy scoring in the Find tab: every query token must FILTER (AND semantics), a token that
// matches a manufacturer name anchors that brand's results to the top (other brands still appear below
// when they satisfy the REMAINING tokens), and the final list is alphabetical. Attribute mapping reuses
// the UUS runtime attributes + uus-synonyms.json phrase table — the single source of layman meaning.

interface SemanticQuery {
  brandIds: string[];
  attrs: UusLaymanAttributes;
  textTokens: string[];
  finish626: boolean;
  /** true when any non-brand constraint exists (attribute group, text token, or 626 finish) */
  hasNonBrand: boolean;
}

/** Parse a query into brand anchors + attribute constraints + leftover text tokens. Words consumed by a
 *  brand name or a synonym phrase are NOT also applied as text filters (no double counting). */
function parseSemanticQuery(query: string, synonyms: UusSynonymsFile | null, index: IndexedProduct[]): SemanticQuery {
  const q = normalize(query);
  const words = q.split(" ").filter(Boolean);
  const consumed: boolean[] = words.map(() => false);
  // Words consumed by a BRAND name must not also act as attribute filters: "Yale Commercial"
  // consumed "commercial" (a synonyms phrase → types.commercial), which would otherwise
  // hard-filter every Yale product out of "yale commercial lever". Phrase-consumed words stay
  // in the attrs query — the phrase IS their attribute meaning.
  const brandConsumed: boolean[] = words.map(() => false);
  const brandIds = new Set<string>();
  if (words.length > 0) {
    // 1) full manufacturer names ("arrow lock", "von duprin", "cal royal products") — longest first
    const names = [...new Set(index.map(e => normalize(e.manufacturerName)))]
      .filter(Boolean)
      .sort((a, b) => b.split(" ").length - a.split(" ").length || a.localeCompare(b));
    for (const name of names) {
      const nw = name.split(" ");
      for (let i = 0; i + nw.length <= words.length; i++) {
        if (nw.some((_, j) => consumed[i + j])) continue;
        if (words.slice(i, i + nw.length).join(" ") !== name) continue;
        const mfr = index.find(e => normalize(e.manufacturerName) === name);
        if (mfr) brandIds.add(mfr.manufacturerId);
        nw.forEach((_, j) => { consumed[i + j] = true; brandConsumed[i + j] = true; });
        break;
      }
    }
    // 2) single-word brand tokens (first word of a manufacturer name, ≥3 chars): "arrow", "schlage", "best"
    const firstWords = new Set(names.map(nm => nm.split(" ")[0]).filter(w => w.length >= 3));
    words.forEach((w, i) => {
      if (consumed[i] || !firstWords.has(w)) return;
      const mfr = index.find(e => normalize(e.manufacturerName).split(" ")[0] === w);
      if (mfr) {
        brandIds.add(mfr.manufacturerId);
        consumed[i] = true;
        brandConsumed[i] = true;
      }
    });
    // 3) synonym phrases (multi-word first); normalized keys so "full-size"/"cush-n-stop" match the
    //    space-normalized query ("full size"/"cush n stop")
    const phrases = Object.keys(synonyms?.phrases ?? {})
      .map(p => ({ raw: p, norm: normalize(p) }))
      .filter(p => p.norm)
      .sort((a, b) => b.norm.split(" ").length - a.norm.split(" ").length || a.norm.localeCompare(b.norm));
    for (const { norm } of phrases) {
      const pw = norm.split(" ");
      for (let i = 0; i + pw.length <= words.length; i++) {
        if (pw.some((_, j) => consumed[i + j])) continue;
        if (words.slice(i, i + pw.length).join(" ") !== norm) continue;
        pw.forEach((_, j) => (consumed[i + j] = true));
        break;
      }
    }
    // 4) brand PREFIX tokens — partial brand names must anchor their brand: "cor" → corbin-russwin,
    //    "sarge" → sargent, "sch" → schlage. A run of consecutive unconsumed tokens that is a
    //    case-insensitive prefix of a brand's NAME WORDS anchors that brand and is consumed (it must
    //    not also be applied as a text/attribute filter — same rule as brandConsumed above). Rule for
    //    single-token anchors: token length ≥ 3 ("cor" → corbin-russwin). A short token ("co r" → the
    //    leading 2-char "co") is only accepted when a SECOND token disambiguates: each consecutive
    //    query token must prefix the brand's consecutive name word ("co"+"r" → cor|bin r|usswin =
    //    corbin-russwin — beats compx/codelocks which only match the first word). Ambiguity rule
    //    (owner directive): when several brands tie, anchor ALL of them — never a wrong single brand;
    //    a longer run outranks a shorter one, and the next scan pass resolves any remaining run.
    {
      const unconsumed: { word: string; i: number }[] = [];
      words.forEach((w, i) => { if (!consumed[i]) unconsumed.push({ word: w, i }); });
      if (unconsumed.length > 0) {
        const lexWords = new Map<string, string[]>();
        const prodCount = new Map<string, number>();
        for (const e of index) {
          if (!lexWords.has(e.manufacturerId)) {
            lexWords.set(e.manufacturerId, normalize(e.manufacturerName).split(" ").filter(Boolean));
          }
          prodCount.set(e.manufacturerId, (prodCount.get(e.manufacturerId) ?? 0) + 1);
        }
        const lex = [...lexWords.entries()];
        // Repeatedly find the best (longest) prefix run; resolve it, then rescan the remainder.
        for (;;) {
          let best: { score: number; p: number; ids: string[] } | null = null;
          for (let p = 0; p < unconsumed.length; p++) {
            const first = unconsumed[p];
            if (first.word.length < 2) continue; // a 1-char token can't lead a brand anchor
            for (const [id, bWords] of lex) {
              let score = 0;
              while (
                score < bWords.length &&
                p + score < unconsumed.length &&
                bWords[score].startsWith(unconsumed[p + score].word)
              ) score++;
              // Single-token matches need ≥3 chars ("cor"/"sch"/"sarge"); 2-char first tokens are
              // only kept when a second token extends the run ("co r") and disambiguates the brand.
              if (score === 0 || (score === 1 && first.word.length < 3)) continue;
              if (!best || score > best.score) best = { score, p, ids: [id] };
              else if (score === best.score && best.p === p && !best.ids.includes(id)) best.ids.push(id);
            }
          }
          if (!best) break;
          // Exact-name single-token ties ("cor" → corbin-russwin ≈ compx ≈ codelocks) resolve by
          // catalog prominence (most products = the brand the owner means). On an exact product-count
          // tie we anchor ALL tied brands — never a wrong single brand.
          if (best.score === 1 && best.ids.length > 1) {
            let maxC = -1;
            for (const id of best.ids) maxC = Math.max(maxC, prodCount.get(id) ?? 0);
            const top = best.ids.filter(id => (prodCount.get(id) ?? 0) === maxC);
            if (top.length === 1) best = { score: 1, p: best.p, ids: top };
            // else: equal prominence → anchor all top brands.
            else best = { score: 1, p: best.p, ids: top };
          }
          for (let k = 0; k < best.score; k++) {
            const u = unconsumed[best.p + k];
            consumed[u.i] = true;
            brandConsumed[u.i] = true;
          }
          for (const id of best.ids) brandIds.add(id);
          for (let k = best.score - 1; k >= 0; k--) unconsumed.splice(best.p + k, 1);
        }
      }
    }
  }
  const textTokens = words.filter((_, i) => !consumed[i]);
  // Attribute meaning comes from non-brand words only (see brandConsumed note above).
  const attrs = parseLaymanQuery(words.filter((_, i) => !brandConsumed[i]).join(" "), synonyms);
  const finish626 = /\b(26d|us26d|626)\b/.test(q);
  const hasNonBrand =
    finish626 ||
    textTokens.length > 0 ||
    ["categories", "grades", "functions", "finishes", "cylinders", "styles", "types", "features"]
      .some(k => (attrs as Record<string, Set<string>>)[k].size > 0);
  return { brandIds: [...brandIds], attrs, textTokens, finish626, hasNonBrand };
}

/** Does a product satisfy the cylinder constraints? Type match, or an in-file IC-option signal
 *  (Arrow's "-SIC / Large Format Interchangeable Core (LFIC)" derives sf-ic because the series also
 *  carries -IC SFIC — the option text is the honest LFIC/FSIC signal). */
function cylinderMatches(a: UusAttributes, p: ProductSeries, cyls: Set<string>): boolean {
  if (cyls.has(a.cylinderType.id)) return true;
  const optsText = ["cylinder", "corePrep", "coreType", "cylinderPrep", "core", "cylinderTech", "keying"]
    .flatMap(k => (p.options?.[k] ?? []).map(o => normalize(`${o.code ?? ""} ${o.name ?? ""} ${o.description ?? ""}`)))
    .join(" ");
  if (cyls.has("lf-ic") && /lfic|full ?size|large format|fsic/.test(optsText)) return true;
  if (cyls.has("sf-ic") && /\bsfic\b|small format/.test(optsText)) return true;
  return false;
}

/** Does the product offer finish 626 specifically (code 626, or a 626/26D/satin-chrome option name)? */
function offersFinish626(p: ProductSeries): boolean {
  return (p.options?.["finish"] ?? []).some(o => {
    const code = o.code ?? "";
    const t = normalize(`${code} ${o.name ?? ""} ${o.description ?? ""}`);
    return code === "626" || /\b626\b|26d|satin chrome|satin chromium/.test(t);
  });
}

/** Evaluate one product against the semantic query's non-brand constraints. Returns display chips, or
 *  null when any token constraint fails (AND semantics). */
function semanticMatch(entry: IndexedProduct, sq: SemanticQuery): string[] | null {
  const p = entry.product;
  const a = deriveUus(p);
  const chips: string[] = [];
  const q = sq.attrs;
  if (q.categories.size) {
    if (![...q.categories].some(c => categoryFormMatches(c, p, a))) return null;
    chips.push(`Category: ${a.category.label}`);
  }
  if (q.grades.size) {
    if (!q.grades.has(a.grade.id)) return null;
    chips.push(`Grade: ${a.grade.label}`);
  }
  if (q.functions.size) {
    const hit = a.functions.find(f => q.functions.has(f.id));
    if (!hit) return null;
    chips.push(`Function: ${hit.label}`);
  }
  if (q.finishes.size) {
    const hit = a.finishFamilies.find(f => q.finishes.has(f.id));
    if (!hit) return null;
    chips.push(`Finish: ${hit.label}`);
  }
  if (q.cylinders.size) {
    if (!cylinderMatches(a, p, q.cylinders)) return null;
    const matchedId = q.cylinders.has(a.cylinderType.id)
      ? a.cylinderType.id
      : q.cylinders.has("lf-ic")
        ? "lf-ic"
        : "sf-ic";
    chips.push(`Cylinder: ${UUS_CYLINDER_TYPES[matchedId] ?? matchedId}`);
  }
  if (q.styles.size) {
    const nameText = normalize(`${p.name} ${p.series}`);
    // Form language from the product's own name/style options is authoritative: a product whose
    // name or style option says "knob" is a knob even when its UUS designStyle buckets to "flat"
    // (e.g. Schlage "Bowery — Modern Cylindrical Knob" derives flat via the word "modern").
    const styleOptText = (p.options?.["style"] ?? [])
      .map(o => normalize(`${o.name ?? ""} ${o.code ?? ""}`))
      .join(" ");
    const isKnobForm = a.designStyle.id === "knob" || /\bknob(s)?\b/.test(nameText) || /\bknob(s)?\b/.test(styleOptText);
    let ok = false;
    if (q.styles.has("knob") && isKnobForm) {
      ok = true;
      chips.push("Style: Knob");
    } else if (q.styles.has("lever") && isLeverForm(p, a)) {
      // Shared lever-form rule (uus.ts): non-knob product with a concrete lever-form designStyle
      // bucket (flat/straight/curved/standard/lever) in a lock category, OR "lever"/"cylindrical"
      // in its own name/series/style options. Fixes Marks USA "195N/RA" (bucket flat), PDQ
      // "GT126-PHI" (bucket straight), Cal-Royal GN00 (name says Lever) — previously excluded
      // because the gate demanded the literal words lever|cylindrical in the name.
      ok = true;
      chips.push("Style: Lever");
    } else if (q.styles.has(a.designStyle.id)) {
      ok = true;
      chips.push(`Style: ${a.designStyle.label}`);
    }
    if (!ok) return null;
  }
  if (q.types.size) {
    if (!(p.type && q.types.has(p.type))) return null;
    chips.push(`Type: ${p.type}`);
  }
  if (q.features.size) {
    const sizeText = normalize(a.sizing.join(" ") + " " + (p.description ?? ""));
    const hit = [...q.features].find(f => sizeText.includes(f));
    if (!hit) return null;
    chips.push(`Feature: ${hit}`);
  }
  if (sq.finish626) {
    if (!offersFinish626(p)) return null;
    chips.push("Finish: Satin Chrome (626)");
  }
  for (const tok of sq.textTokens) {
    if (!entry.searchText.includes(tok)) return null;
  }
  return chips;
}

/** Brand-anchored progressive search. Anchored brands rank first (alphabetical within), then all other
 *  matching products alphabetical by manufacturer then product name. A brand-only query shows only the
 *  anchored brand; a brand + attributes query shows the brand first and other brands' matching products
 *  below (owner rule: other options appear only if they match the remaining words). */
function semanticSearch(index: IndexedProduct[], filters: SearchFilters, limit: number): SearchResult[] {
  const sq = parseSemanticQuery(filters.query, filters.synonyms ?? null, index);
  const results: SearchResult[] = [];
  for (const entry of index) {
    const product = entry.product;
    const normCategory = normalizeCategory(product.category ?? "");
    // Existing filter chips compose with query narrowing (requirement 5).
    if (filters.category && normCategory !== filters.category) continue;
    const productGrade = extractGrade(product);
    if (filters.grade && productGrade !== filters.grade) continue;
    if (filters.commercial === true && !isCommercial(product)) continue;
    if (filters.commercial === false && isCommercial(product)) continue;
    if (filters.manufacturer && entry.manufacturerId !== filters.manufacturer) continue;

    const anchored = sq.brandIds.includes(entry.manufacturerId);
    // Brand-only query (no other tokens) → only the anchored brand's products are shown.
    if (sq.brandIds.length > 0 && !anchored && !sq.hasNonBrand) continue;

    const chips = semanticMatch(entry, sq);
    if (!chips) continue;

    results.push({
      manufacturerId: entry.manufacturerId,
      manufacturerName: entry.manufacturerName,
      productName: product.name,
      series: product.series,
      category: normCategory,
      grade: productGrade || "—",
      partNumberPattern: product.partNumberPattern,
      matchScore: chips.length,
      matchedAttributes: chips,
      brandAnchored: anchored,
    });
  }
  results.sort((x, y) => {
    const ax = sq.brandIds.includes(x.manufacturerId) ? 0 : 1;
    const ay = sq.brandIds.includes(y.manufacturerId) ? 0 : 1;
    if (ax !== ay) return ax - ay;
    return (
      x.manufacturerName.localeCompare(y.manufacturerName) ||
      x.productName.localeCompare(y.productName) ||
      x.series.localeCompare(y.series)
    );
  });
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
