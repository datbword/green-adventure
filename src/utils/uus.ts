/**
 * Unified Universal Schema (UUS) — Phase A (2026-08-11).
 *
 * Brand-agnostic attribute layer derived from the per-manufacturer data files.
 * Every product in the 68 brand files can be described by the same vocabulary:
 *
 *   category      — what kind of hardware (cylindrical, mortise, exit device, ...)
 *   grade         — 1 | 2 | 3 | residential
 *   function      — what it does (passage, privacy, storeroom, classroom, ...)
 *   designStyle   — lever/knob silhouette bucket + manufacturer style name
 *   sizing        — human-readable sizing/power facts (backset, voltage, closer size, ...)
 *   finishFamily  — brass / bronze / chrome / stainless / nickel / black / ...
 *   cylinderType  — conventional | SFIC | LFIC | keyed-removable | electronic | none
 *
 * Everything here is DERIVED from data the manufacturer files already carry
 * (category/grade fields, option codes & names, patterns, descriptions) — the
 * UUS layer adds no invented facts, only a normalized vocabulary so Decode can
 * translate part numbers to plain English, Search can match layman phrases, and
 * a future constraint engine can reason across brands.
 */
import type { DecodeResult } from "~/utils/part-decoder";
import type { ManufacturerData, ProductSeries, SeriesOption } from "~/types";

// ─────────────────────────────── Canonical vocabularies ───────────────────────────────

export const UUS_CATEGORIES: Record<string, string> = {
  "cylindrical": "Cylindrical Lock",
  "mortise": "Mortise Lock",
  "deadbolt": "Deadbolt",
  "multipoint": "Multipoint Lock",
  "exit-device": "Exit Device",
  "door-closer": "Door Closer",
  "operator": "Door Operator",
  "electromagnetic": "Electromagnetic Lock",
  "electric-strike": "Electric Strike",
  "electronic": "Electronic / Smart Lock",
  "padlock": "Padlock",
  "cylinder-core": "Cylinder / Core",
  "cabinet-lock": "Cabinet / Cam Lock",
  "safe-lock": "Safe Lock",
  "handleset": "Handleset",
  "hinge": "Hinge",
  "mullion": "Mullion",
  "coordinator": "Coordinator",
  "trim": "Trim / Plate",
  "strike": "Strike",
  "accessory": "Accessory",
  "key-machine": "Key Machine",
  "key-blank": "Key Blank",
  "pushbutton": "Pushbutton Lock",
  "other": "Other",
};

export const UUS_GRADES: Record<string, string> = {
  "1": "Grade 1 (Heavy Duty)",
  "2": "Grade 2 (Standard Duty)",
  "3": "Grade 3 (Light Duty)",
  "residential": "Residential",
};

export const UUS_FUNCTIONS: Record<string, string> = {
  "passage": "Passage",
  "privacy": "Privacy",
  "entrance": "Entrance / Keyed Entry",
  "office": "Office",
  "storeroom": "Storeroom",
  "classroom": "Classroom",
  "classroom-security": "Classroom Security",
  "communicating": "Communicating",
  "dummy": "Dummy Trim",
  "service-station": "Service Station",
  "escape": "Escape / Asylum",
  "hotel": "Hotel",
  "deadbolt": "Deadbolt",
  "deadbolt-double": "Double Cylinder Deadbolt",
  "deadlatch": "Deadlatch",
  "panic-exit": "Panic Exit",
  "closer": "Door Closer",
  "operator": "Door Operator",
  "electromagnetic": "Electromagnetic Lock",
  "electric-strike": "Electric Strike",
  "electronic": "Electronic / Smart Lock",
  "padlock": "Padlock",
  "cylinder-core": "Cylinder / Core",
  "cabinet-lock": "Cabinet / Cam Lock",
  "safe-lock": "Safe Lock",
  "handleset": "Handleset",
  "hinge": "Hinge",
  "mullion": "Mullion",
  "coordinator": "Coordinator",
  "strike": "Strike",
  "trim": "Trim / Plate",
  "key-machine": "Key Machine",
  "key-blank": "Key Blank",
  "lock": "Lock",
};

export const UUS_DESIGN_STYLES: Record<string, string> = {
  "straight": "Straight / Traditional",
  "curved": "Curved",
  "flat": "Flat / Modern",
  "ornate": "Ornate / Decorative",
  "lever": "Lever",
  "knob": "Knob",
  "escutcheon": "Escutcheon / Trim",
  "standard": "Standard",
  "none": "N/A",
};

export const UUS_CYLINDER_TYPES: Record<string, string> = {
  "conventional": "Conventional Cylinder",
  "sf-ic": "SFIC (Small Format Interchangeable Core)",
  "lf-ic": "LFIC (Large Format Interchangeable Core)",
  "keyed-removable": "Keyed-Removable Core",
  "electronic": "Electronic (no mechanical cylinder)",
  "none": "No Cylinder",
};

export interface UusValue {
  id: string;
  label: string;
}
export interface UusAttributes {
  category: UusValue;
  grade: UusValue;
  function: UusValue;
  functions: UusValue[]; // all function semantics the product covers
  designStyle: UusValue;
  styleName: string; // manufacturer's own style name if available
  sizing: string[];
  finishFamilies: UusValue[];
  cylinderType: UusValue;
}

const n = (s: string): string => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

// ─────────────────────────────── Category derivation ───────────────────────────────

const CATEGORY_KEYWORDS: [RegExp, string][] = [
  [/exit device|panic|rim exit|fire exit|exit\b/, "exit-device"],
  [/floor closer|door closer|closer|closing/, "door-closer"],
  [/low energy|operator|automation/, "operator"],
  [/deadbolt|deadlock|dead latch|deadlatch/, "deadbolt"],
  [/multipoint|multi-point/, "multipoint"],
  [/maglock|electromagnetic/, "electromagnetic"],
  [/electric strike|electrified strike|electricstrike/, "electric-strike"],
  [/strike/, "strike"],
  [/smart lock|smart padlock|keypad|electronic|bluetooth|zwave|z-wave|wifi|wi-fi|access control|wireless|proximity|card reader|biometric|keyless|push ?button|digital/, "electronic"],
  [/interchangeable core|ic core|cylinder|core\b/, "cylinder-core"],
  [/cabinet|cam lock|cam\b|locker|drawer|switch lock|plunger|wafer|disc tumbler/, "cabinet-lock"],
  [/safe lock|safe\b/, "safe-lock"],
  [/padlock/, "padlock"],
  [/handleset|handle set|handle-set/, "handleset"],
  [/mullion/, "mullion"],
  [/coordinator/, "coordinator"],
  [/hinge/, "hinge"],
  [/mortise/, "mortise"],
  [/knob|lever|tubular|cylindrical|institutional|detention/, "cylindrical"],
  [/trim|escutcheon|plate|pull|kick|protection|reinforcement|seal|accessory|power supply|module|split finish|thick door|conversion|kit\b|components/, "trim"],
  [/key blank/, "key-blank"],
  [/key machine|pinning kit|software/, "key-machine"],
];

function deriveCategory(product: ProductSeries): UusValue {
  const raw = product.category ?? "";
  const text = n(`${product.name} ${product.description ?? ""} ${raw}`);
  // honor explicit category field first (normalized)
  const catNorm = n(raw);
  // Mechanical pushbutton / mechanical keyless locks are NOT electronic — they are pushbutton locks.
  // (Owner strict rule: only literal "electronic"/"smart" etc. signals imply electronic; "mechanical
  // pushbutton"/"mechanical keyless" are purely mechanical, no electronics.) Stronger form signals
  // (exit-device, deadbolt) still win per the materialized dictionary scan order.
  const mechKeyless = (/mechanical (push ?button|keyless)/.test(catNorm) || /mechanical (push ?button|keyless)/.test(text)) && !/electronic/.test(catNorm);
  if (mechKeyless) {
    if (/exit device|panic|rim exit|fire exit|exit\b/.test(text)) return { id: "exit-device", label: UUS_CATEGORIES["exit-device"] };
    if (/dead ?bolt|dead ?lock|hook bolt/.test(text)) return { id: "deadbolt", label: UUS_CATEGORIES.deadbolt };
    return { id: "pushbutton", label: UUS_CATEGORIES.pushbutton };
  }
  for (const [re, id] of CATEGORY_KEYWORDS) {
    if (re.test(catNorm)) return { id, label: UUS_CATEGORIES[id] };
  }
  for (const [re, id] of CATEGORY_KEYWORDS) {
    if (re.test(text)) return { id, label: UUS_CATEGORIES[id] };
  }
  return { id: "other", label: UUS_CATEGORIES.other };
}

// ─────────────────────────────── Grade derivation ───────────────────────────────

function deriveGrade(product: ProductSeries): UusValue {
  const g = n(product.grade ?? "");
  if (g.includes("grade 1") || g === "1") return { id: "1", label: UUS_GRADES["1"] };
  if (g.includes("grade 2") || g === "2") return { id: "2", label: UUS_GRADES["2"] };
  if (g.includes("grade 3") || g === "3") return { id: "3", label: UUS_GRADES["3"] };
  if (g.includes("residential")) return { id: "residential", label: UUS_GRADES.residential };
  const text = n(`${product.name} ${product.description ?? ""}`);
  // STRICT file-semantics (owner rule, 2026-08-12): only LITERAL "Grade N" statements imply a grade —
  // "heavy duty"/"premium"/"economy" wording does NOT (e.g. Kwikset "Security"/"Signature" tiers,
  // Schlage "F-Series (Premium)", Baldwin "Estate" are residential lines, not ANSI Grade 1).
  if (/grade 1|ansi\/bhma grade 1/.test(text)) return { id: "1", label: UUS_GRADES["1"] };
  if (/grade 2/.test(text)) return { id: "2", label: UUS_GRADES["2"] };
  if (/grade 3/.test(text)) return { id: "3", label: UUS_GRADES["3"] };
  // unambiguous in-file residential signals: the boolean flag, the type field, or the word itself
  if (product.residential === true || product.type === "residential" || /residential/.test(text)) return { id: "residential", label: UUS_GRADES.residential };
  return { id: "", label: "Unknown" };
}

// ─────────────────────────────── Function derivation ───────────────────────────────

const FUNCTION_KEYWORDS: [RegExp, string][] = [
  [/classroom security/, "classroom-security"],
  [/classroom/, "classroom"],
  [/storeroom/, "storeroom"],
  [/passage/, "passage"],
  [/privacy/, "privacy"],
  [/communicating/, "communicating"],
  [/office/, "office"],
  [/keyed entry|entrance|entry\b/, "entrance"],
  [/service station/, "service-station"],
  [/asylum|escape/, "escape"],
  [/dummy/, "dummy"],
  [/double cylinder|double deadbolt/, "deadbolt-double"],
  [/deadbolt|deadlock/, "deadbolt"],
  [/deadlatch/, "deadlatch"],
  [/panic|exit\b/, "panic-exit"],
  [/closer/, "closer"],
  [/operator/, "operator"],
  [/electromagnetic|maglock/, "electromagnetic"],
  [/electric strike/, "electric-strike"],
  [/smart|keypad|electronic|bluetooth|zwave|wifi|wireless|proximity/, "electronic"],
  [/padlock/, "padlock"],
  [/interchangeable core|ic core|cylinder|core\b/, "cylinder-core"],
  [/cabinet|cam lock|cam\b|locker|drawer/, "cabinet-lock"],
  [/safe lock/, "safe-lock"],
  [/handleset|handle set/, "handleset"],
  [/hinge/, "hinge"],
  [/mullion/, "mullion"],
  [/coordinator/, "coordinator"],
  [/strike/, "strike"],
  [/trim|escutcheon|plate|pull/, "trim"],
  [/key blank/, "key-blank"],
  [/key machine|pinning kit|software/, "key-machine"],
];

const CATEGORY_TO_FUNCTION: Record<string, string> = {
  "cylindrical": "lock",
  "mortise": "lock",
  "deadbolt": "deadbolt",
  "multipoint": "deadbolt",
  "exit-device": "panic-exit",
  "door-closer": "closer",
  "operator": "operator",
  "electromagnetic": "electromagnetic",
  "electric-strike": "electric-strike",
  "electronic": "electronic",
  "padlock": "padlock",
  "cylinder-core": "cylinder-core",
  "cabinet-lock": "cabinet-lock",
  "safe-lock": "safe-lock",
  "handleset": "handleset",
  "hinge": "hinge",
  "mullion": "mullion",
  "coordinator": "coordinator",
  "strike": "strike",
  "trim": "trim",
  "key-machine": "key-machine",
  "key-blank": "key-blank",
  "pushbutton": "lock",
};

const FUNCTION_CANONICAL_ORDER = [
  "passage", "privacy", "entrance", "office", "storeroom", "classroom", "classroom-security",
  "communicating", "dummy", "service-station", "escape", "hotel", "deadbolt", "deadbolt-double",
  "deadlatch", "panic-exit", "closer", "operator", "electromagnetic", "electric-strike",
  "electronic", "padlock", "cylinder-core", "cabinet-lock", "safe-lock", "handleset", "hinge",
  "mullion", "coordinator", "strike", "trim", "key-machine", "key-blank", "lock",
];

/** Map a single option name (or raw text) to a UUS function id, or null. */
export function mapFunctionKeyword(text: string): string | null {
  const t = n(text);
  if (!t) return null;
  for (const [re, id] of FUNCTION_KEYWORDS) if (re.test(t)) return id;
  return null;
}

function deriveFunctions(product: ProductSeries): UusValue[] {
  const found = new Set<string>();
  // 1) options.function names (strongest signal)
  const fnOpts: SeriesOption[] = product.options?.["function"] ?? [];
  for (const o of fnOpts) {
    const optText = `${o.code} ${o.name} ${o.description ?? ""}`;
    const id = mapFunctionKeyword(optText);
    if (id) {
      found.add(id);
      // "Keyed Entry/Office" and "Entrance/Office" option names: /office/ scans before
      // /keyed entry|entrance|entry/ and shadows entrance — the option covers both.
      if (id === "office" && /keyed entry|entrance|entry\b/.test(n(optText))) found.add("entrance");
    }
  }
  // 2) pattern tokens named function / series literal that encode a function
  const text = n(`${product.name} ${product.description ?? ""}`);
  // 3) name/description keywords for single-function products
  for (const [re, id] of FUNCTION_KEYWORDS) {
    if (re.test(text)) { found.add(id); break; } // only the first explicit hit
  }
  // "Keyed Entry/Office" / "Entrance/Office" names: the first-hit scan above adds office
  // (listed before entrance in FUNCTION_KEYWORDS) and shadows entrance. Both functions apply.
  if (found.has("office") && !found.has("entrance") && /keyed entry|entrance|entry\b/.test(text)) {
    found.add("entrance");
  }
  // 4) category fallback
  const cat = deriveCategory(product).id;
  if (found.size === 0 && CATEGORY_TO_FUNCTION[cat]) found.add(CATEGORY_TO_FUNCTION[cat]);
  const list = [...found].sort((a, b) => FUNCTION_CANONICAL_ORDER.indexOf(a) - FUNCTION_CANONICAL_ORDER.indexOf(b));
  return list.map(id => ({ id, label: UUS_FUNCTIONS[id] ?? id }));
}

// ─────────────────────────────── Design style derivation ───────────────────────────────

const STYLE_BUCKET_KEYWORDS: [RegExp, string][] = [
  [/sierra|straight|standard|traditional|classic|colonial|victorian/, "straight"],
  [/sonnet|curve|contour|crescent|rounded/, "curved"],
  [/broadway|flat|modern|minimal|square|linear/, "flat"],
  [/abbey|athena|augusta|florentine|venetian|craftsman|mission|decorative|designer|ornate|royal|elegant/, "ornate"],
  [/knob|ball|round|oval|egg|crystal|colonial knob/, "knob"],
  [/escutcheon|plate|rose/, "escutcheon"],
];

// Lever-form determination (shared by deriveDesignStyle, matchLayman and the Find tab's
// semanticSearch). A product is lever-form when it is NOT a knob and either:
//   (a) its own name/series or style options say "lever"/"cylindrical" in a lock category, or
//   (b) its derived designStyle bucket is a concrete lever silhouette (straight/curved/flat/
//       standard/lever) in a category where that bucket implies a lever handle.
// Knob form always wins. Category guards keep description-level "lever" mentions (deadlatch
// "paddle or lever trim", padlock "dual locking levers", mortise "5-lever mechanism"),
// exit-device lever-trim options (BEST EX5100, Arrow 4800 — pushbar exits, not lever locks)
// and non-lock buckets (padlock "standard", trim plates) from becoming levers.
const LEVER_BUCKET_CATS = new Set(["cylindrical", "mortise", "electronic", "pushbutton", "handleset", "multipoint"]);
const LEVER_WORD_CATS = new Set([...LEVER_BUCKET_CATS, "deadbolt"]);
const LEVER_BUCKETS = new Set(["lever", "straight", "curved", "flat", "standard"]);

export function isLeverForm(product: ProductSeries, a?: UusAttributes): boolean {
  const attrs = a ?? deriveUus(product);
  const nameText = n(`${product.name} ${product.series}`);
  const styleOptText = (product.options?.["style"] ?? [])
    .map(o => n(`${o.name ?? ""} ${o.code ?? ""}`))
    .join(" ");
  if (attrs.designStyle.id === "knob" || /\bknob(s)?\b/.test(nameText) || /\bknob(s)?\b/.test(styleOptText)) return false;
  const cat = attrs.category.id;
  const leverWord = /\blever(s)?\b/.test(nameText) || /\blever(s)?\b/.test(styleOptText);
  if ((leverWord || /cylindrical/.test(nameText)) && LEVER_WORD_CATS.has(cat)) return true;
  if (LEVER_BUCKETS.has(attrs.designStyle.id) && LEVER_BUCKET_CATS.has(cat)) return true;
  return false;
}

function deriveDesignStyle(product: ProductSeries): { style: UusValue; name: string } {
  const styleOpts: SeriesOption[] = product.options?.["style"] ?? [];
  if (styleOpts.length === 0) {
    // In-file form language on trim/lever options (e.g. "classic curved escutcheon",
    // "Standard curved lever", "Sierra Rose trim plate", "Full Escutcheon"). Order matters:
    // concrete form words beat generic style words (classic/traditional/contemporary).
    const TRIM_LEVER_FORM: [RegExp, string][] = [
      [/curved|curve|contour|crescent/, "curved"],
      [/straight|sierra/, "straight"],
      [/flat|broadway/, "flat"],
      [/escutcheon/, "escutcheon"],
      [/square/, "flat"],
      [/knob/, "knob"],
    ];
    for (const key of ["trim", "lever", "design"]) {
      for (const o of product.options?.[key] ?? []) {
        if (!o) continue;
        const optText = n(`${o.name ?? ""} ${o.code ?? ""} ${o.description ?? ""}`);
        for (const [re, id] of TRIM_LEVER_FORM) {
          if (re.test(optText)) return { style: { id, label: UUS_DESIGN_STYLES[id] }, name: "" };
        }
      }
    }
    const text = n(`${product.name} ${product.description ?? ""}`);
    if (/knob/.test(text)) return { style: { id: "knob", label: UUS_DESIGN_STYLES.knob }, name: "" };
    // Products whose OWN name/series says "Lever" are lever-form (Cal-Royal "GN00 Lever Lock",
    // Dexter "J54L Keyed Entry Lever"). Name+series ONLY — description "lever" mentions are
    // traps (deadlatch "lever trim options", padlock "dual locking levers", mortise
    // "5-lever mechanism"). Category guard keeps closers/exits/padlocks/trims out.
    if (/\blever(s)?\b/.test(n(`${product.name} ${product.series}`)) && LEVER_WORD_CATS.has(deriveCategory(product).id)) {
      return { style: { id: "lever", label: UUS_DESIGN_STYLES.lever }, name: "" };
    }
    return { style: { id: "none", label: UUS_DESIGN_STYLES.none }, name: "" };
  }
  let bucket: string | null = null;
  let name = "";
  for (const o of styleOpts) {
    const optText = n(`${o.name} ${o.code} ${o.description ?? ""}`);
    if (!name) name = optText.replace(/\b(lever|knob|style)\b/g, "").trim().replace(/\s+/g, " ") || o.code;
    for (const [re, id] of STYLE_BUCKET_KEYWORDS) {
      if (re.test(optText)) { bucket = id; break; }
    }
    if (bucket) break;
  }
  return {
    style: { id: bucket ?? "standard", label: UUS_DESIGN_STYLES[bucket ?? "standard"] },
    name: name.length > 28 ? name.slice(0, 28) : name,
  };
}

// ─────────────────────────────── Sizing / power derivation ───────────────────────────────

const SIZING_KEYS = ["backset", "backsetCode", "latch", "size", "sizes", "voltage", "power", "wiring", "electrified", "force", "width", "length", "height", "doorHeight", "thickDoor", "doorThickness", "rail", "coreSize", "bolt", "keysize", "pins", "arm", "cover", "mount", "mounting", "valve", "delay", "fastener", "faceplate", "amps", "powerSupply", "shackleHeight", "thickness", "glassThickness", "cylinderSize", "coreHousing", "widthHeight"];
const SIZING_LABELS: Record<string, string> = {
  backset: "backset", backsetCode: "backset", latch: "latch", size: "size", voltage: "voltage", power: "power",
  wiring: "wiring", electrified: "electrified", force: "force", width: "width", length: "length", height: "height",
  doorHeight: "door height", thickDoor: "thick door", doorThickness: "thick door", rail: "rail", coreSize: "core size",
  bolt: "bolt", keysize: "key size", sizes: "size", pins: "pins", arm: "arm", cover: "cover", mount: "mounting",
  mounting: "mounting", valve: "valve", delay: "delay", fastener: "fastener", faceplate: "faceplate",
  amps: "power supply", powerSupply: "power supply", shackleHeight: "shackle height", thickness: "thickness",
  glassThickness: "glass", cylinderSize: "cylinder size", coreHousing: "housing", widthHeight: "door size",
};

function deriveSizing(product: ProductSeries): string[] {
  const out: string[] = [];
  const cleanVal = (o: SeriesOption, label: string): string => {
    // Prefer the description when the name is just a code repetition ("BAT — BAT — Battery" / "6 — 6 — 6-pin").
    const nm = (o.name ?? "").replace(/\s+/g, " ").trim();
    const desc = (o.description ?? "").replace(/\s+/g, " ").trim();
    let val = nm;
    // strip a leading "<code> — " repetition when the name begins with the code
    const code = o.code ?? "";
    if (code) {
      const esc = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const codeDash = new RegExp("^" + esc + "\\s*—\\s*", "i");
      let prev = "";
      while (val !== prev && codeDash.test(val)) { prev = val; val = val.replace(codeDash, "").trim(); }
    }
    // if the name collapses to nothing/just the code, fall back to the description
    if (!val || val.toLowerCase() === (code ?? "").toLowerCase()) {
      val = desc && !/none|n\/a|not spec/i.test(desc) ? desc : "";
    }
    // avoid redundant label repeats ("... Backset backset" → "... Backset")
    const escL = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const labelRe = new RegExp("\\b" + escL + "\\b", "i");
    if (labelRe.test(val)) return val;
    return val ? val + " " + label : "";
  };
  for (const key of SIZING_KEYS) {
    const opts: SeriesOption[] = product.options?.[key] ?? [];
    for (const o of opts) {
      if (!o) continue;
      const code = o.code ?? "";
      const nm = o.name ?? "";
      if (!code && !nm) continue;
      const label = SIZING_LABELS[key] ?? key;
      const text = n(`${code} ${nm} ${o.description ?? ""}`);
      // skip pure placeholder/empty entries
      if (/none|n\/a|not spec|^--$|^-$/.test(text) && !code && !nm) continue;
      const phrase = cleanVal(o, label);
      if (phrase && !out.some(x => x === phrase)) out.push(phrase);
    }
  }
  // pin counts from availablePins
  const fnOpts: SeriesOption[] = product.options?.["function"] ?? [];
  for (const o of fnOpts) {
    if (o.availablePins?.length) {
      const p = `6-pin compatible`;
      if (!out.includes(p)) out.push(p);
    }
  }
  return out.slice(0, 8);
}

// ─────────────────────────────── Finish family derivation ───────────────────────────────

const FINISH_FAMILY_CODE: [RegExp, string][] = [
  [/^(605|606|003|030|050|055|060|688|3|7)\b/, "brass"],
  [/^(612|613|613e|10b|102|112|11p|695|dbz)\b/, "bronze"],
  [/^(625|626|26|26d|260)\b/, "chrome"],
  [/^(629|630|32d)\b/, "stainless"],
  [/^(619|620|15|150|15a|satin nickel)\b/, "nickel"],
  [/^(622|19|190|blk|black|matte black)\b/, "black"],
  [/^(gold|688|gl)\b/, "gold"],
  [/^(689|al)\b/, "aluminum"],
];
const FINISH_FAMILY_NAME: [RegExp, string][] = [
  [/brass/, "brass"],
  [/bronze/, "bronze"],
  [/chrome/, "chrome"],
  [/nickel/, "nickel"],
  [/stainless/, "stainless"],
  [/black/, "black"],
  [/gold/, "gold"],
  [/aluminum|anodized/, "aluminum"],
  [/steel/, "steel"],
  [/white/, "white"],
  [/brown/, "brown"],
  [/copper/, "copper"],
];

/** Map ONE finish option (code+name) to its brand-agnostic finish family, or null. */
export function finishFamilyFromOption(o: SeriesOption | null | undefined): UusValue | null {
  if (!o) return null;
  const text = n(`${o.code ?? ""} ${o.name ?? ""} ${o.description ?? ""}`);
  let fam: string | null = null;
  for (const [re, id] of FINISH_FAMILY_CODE) {
    if (re.test(text)) { fam = id; break; }
  }
  if (!fam) {
    for (const [re, id] of FINISH_FAMILY_NAME) {
      if (re.test(text)) { fam = id; break; }
    }
  }
  if (!fam) return null;
  const labels: Record<string, string> = {
    brass: "Brass", bronze: "Bronze", chrome: "Chrome", stainless: "Stainless Steel",
    nickel: "Nickel", black: "Black", gold: "Gold", aluminum: "Aluminum", steel: "Steel", white: "White",
    brown: "Brown", copper: "Copper",
  };
  return { id: fam, label: labels[fam] ?? fam };
}

function deriveFinishFamilies(product: ProductSeries): UusValue[] {
  const families = new Set<string>();
  const finOpts: SeriesOption[] = product.options?.["finish"] ?? [];
  for (const o of finOpts) {
    const fam = finishFamilyFromOption(o);
    if (fam) families.add(fam.id);
  }
  // product-level hint from name/description when no finish options exist
  if (families.size === 0) {
    const text = n(`${product.name} ${product.description ?? ""}`);
    for (const [re, id] of FINISH_FAMILY_NAME) {
      if (re.test(text)) { families.add(id); break; }
    }
  }
  const order = ["brass", "bronze", "chrome", "stainless", "nickel", "black", "gold", "aluminum", "steel", "white", "brown", "copper"];
  const labels: Record<string, string> = {
    brass: "Brass", bronze: "Bronze", chrome: "Chrome", stainless: "Stainless Steel",
    nickel: "Nickel", black: "Black", gold: "Gold", aluminum: "Aluminum", steel: "Steel", white: "White",
    brown: "Brown", copper: "Copper",
  };
  return [...families].sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(id => ({ id, label: labels[id] ?? id }));
}

// ─────────────────────────────── Cylinder type derivation ───────────────────────────────

function deriveCylinderType(product: ProductSeries): UusValue {
  const pattern = product.partNumberPattern ?? "";
  const text = n(`${pattern} ${product.name} ${product.description ?? ""}`);
  const optsText: string[] = [];
  for (const key of ["cylinder", "corePrep", "coreType", "cylinderPrep", "core", "cylinderTech", "keying"]) {
    for (const o of product.options?.[key] ?? []) optsText.push(n(`${o.code} ${o.name} ${o.description ?? ""}`));
  }
  const all = [text, ...optsText].join(" ");
  // Mechanical pushbutton / mechanical keyless locks have NO electronics — no electronic cylinder.
  // (Owner strict rule: only literal electronic signals imply electronic; these are purely mechanical.)
  // Key-override variants carry a conventional key cylinder (Simplex 1021, Lockey 2200KO).
  if (/mechanical (push ?button|keyless)/.test(all) && !/electronic/.test(all)) {
    if (/\bkey override\b|keyed override|keyed entry|keyed entrance|with key\b/.test(all)) {
      return { id: "conventional", label: UUS_CYLINDER_TYPES.conventional };
    }
    return { id: "none", label: UUS_CYLINDER_TYPES.none };
  }
  // electronic/smart first — no mechanical cylinder
  if (/smart|keypad|bluetooth|zwave|wifi|electronic lock|access control|keyless|proximity|card reader|biometric|pushbutton|mechanical keyless/.test(all)) {
    return { id: "electronic", label: UUS_CYLINDER_TYPES.electronic };
  }
  // Strong LFIC signal with NO strong SFIC signal → LFIC wins (e.g. LSDA LFIC-SC, "Large Format Interchangeable Core").
  // QL carries BOTH -IC (SFIC) and -SIC (LFIC) options, so it still falls through to the SFIC branch below (option order IC before SIC).
  const strongSfic = /\bsfic\b|small format/.test(all);
  const strongLfic = /\blfic\b|large format|\bsic\b|-sic\b/.test(all);
  if (strongLfic && !strongSfic) return { id: "lf-ic", label: UUS_CYLINDER_TYPES["lf-ic"] };
  // SFIC needs an EXPLICIT signal — bare "core" (deadbolt core / removable core / rekeyable cylinder core)
  // does NOT imply SFIC (Baldwin "single cylinder deadbolt core", master-lock "removable core", sargent "conventional").
  if (/\bsfic\b|small format|interchangeable core\b|\bic\b|-ic\b|accepts all best cores|best core housing/.test(all)) return { id: "sf-ic", label: UUS_CYLINDER_TYPES["sf-ic"] };
  if (strongLfic) return { id: "lf-ic", label: UUS_CYLINDER_TYPES["lf-ic"] };
  if (/\bkil\b|keyed.?removable/.test(all)) return { id: "keyed-removable", label: UUS_CYLINDER_TYPES["keyed-removable"] };
  if (/\bcs\b|schlage c|conventional|fixed keyway|standard cylinder|6-pin solid/.test(all)) return { id: "conventional", label: UUS_CYLINDER_TYPES.conventional };
  // products whose functions are keyed (entrance/storeroom/classroom/...) imply a conventional cylinder
  if (/\bkeyway\b|keyed entry|keyed entrance|storeroom|classroom|office/.test(all)) return { id: "conventional", label: UUS_CYLINDER_TYPES.conventional };
  return { id: "none", label: UUS_CYLINDER_TYPES.none };
}

// ─────────────────────────────── Public API ───────────────────────────────

/** Derive the full UUS attribute set for one product. Pure, deterministic. */
export function deriveUus(product: ProductSeries): UusAttributes {
  const category = deriveCategory(product);
  const functions = deriveFunctions(product);
  const { style, name: styleName } = deriveDesignStyle(product);
  return {
    category,
    grade: deriveGrade(product),
    function: functions[0] ?? { id: "lock", label: UUS_FUNCTIONS.lock },
    functions,
    designStyle: style,
    styleName,
    sizing: deriveSizing(product),
    finishFamilies: deriveFinishFamilies(product),
    cylinderType: deriveCylinderType(product),
  };
}

/** Extra searchable text (layman phrases) derived from UUS attributes. */
export function uusSearchText(product: ProductSeries): string {
  const a = deriveUus(product);
  const parts: string[] = [];
  parts.push(a.category.label);
  if (a.grade.id) parts.push(a.grade.label);
  for (const f of a.functions) parts.push(f.label);
  if (a.designStyle.id && a.designStyle.id !== "none") parts.push(a.designStyle.label);
  if (a.styleName) parts.push(a.styleName);
  for (const f of a.finishFamilies) parts.push(f.label);
  if (a.cylinderType.id && a.cylinderType.id !== "none") parts.push(a.cylinderType.label);
  parts.push(...a.sizing);
  // layman synonyms for common hardware vocabulary
  if (a.category.id === "exit-device") parts.push("panic bar", "crash bar", "emergency exit");
  if (a.category.id === "electronic" || a.cylinderType.id === "electronic") parts.push("smart lock", "keyless", "keypad lock");
  if (a.cylinderType.id === "sf-ic" || a.cylinderType.id === "lf-ic") parts.push("interchangeable core", "core lock");
  if (a.category.id === "door-closer") parts.push("hydraulic closer", "auto closer");
  if (a.category.id === "padlock") parts.push("lock", "security lock");
  if (a.category.id === "deadbolt") parts.push("deadlock");
  return parts.join(" ");
}

/** One-line-ish plain English summary of a product's UUS attributes. */
export function uusSummary(product: ProductSeries): string[] {
  const a = deriveUus(product);
  const lines: string[] = [];
  const grade = a.grade.id ? `${a.grade.label.toLowerCase()} ` : "";
  lines.push(`${grade}${a.category.label.toLowerCase()}`);
  if (a.functions.length && a.functions[0].id !== a.category.id) {
    lines.push(`function: ${a.functions.map(f => f.label).join(", ").toLowerCase()}`);
  }
  if (a.styleName) lines.push(`style: ${a.styleName}`);
  if (a.finishFamilies.length) lines.push(`finish family: ${a.finishFamilies.map(f => f.label.toLowerCase()).join(", ")}`);
  if (a.cylinderType.id && a.cylinderType.id !== "none") lines.push(`cylinder: ${a.cylinderType.label.toLowerCase()}`);
  if (a.sizing.length) lines.push(`sizing: ${a.sizing.join("; ")}`);
  return lines;
}

/** Plain-English translation of a decoded part number, using RUNTIME UUS derivation (canonical source). */
export function translateDecoded(
  result: DecodeResult,
  manufacturerFiles: Record<string, ManufacturerData>,
): string[] {
  const mfr = manufacturerFiles[result.manufacturerId];
  const product = mfr?.products.find(p => p.series === result.series) ?? null;
  const lines: string[] = [];
  if (!product) return lines;
  const a = deriveUus(product);
  const grade = a.grade.id ? `${a.grade.label.toLowerCase()} ` : "";
  lines.push(`${result.manufacturerName} ${product.name} — ${grade}${a.category.label.toLowerCase()}`);
  // resolve specific decoded token values to plain English
  const tokenName = (field: string): string | null => {
    const tok = result.tokens.find(t => t.field === field && !t.unknown);
    return tok ? (tok.name || tok.code) : null;
  };
  const fn = tokenName("function");
  if (fn) {
    const id = mapFunctionKeyword(fn);
    lines.push(`function: ${id ? UUS_FUNCTIONS[id].toLowerCase() : fn.toLowerCase()}`);
  } else if (a.functions.length && a.functions[0].id !== "lock") {
    lines.push(`function: ${a.functions[0].label.toLowerCase()}`);
  }
  const style = tokenName("style");
  if (style) lines.push(`style: ${style}`);
  else if (a.styleName) lines.push(`style: ${a.styleName}`);
  const fin = tokenName("finish");
  let fam = a.finishFamilies.length ? a.finishFamilies[0].label.toLowerCase() : "";
  if (fin) {
    // resolve the family from the SPECIFIC decoded finish option (product may span several families)
    const finOpt = product.options?.["finish"]?.find(o => {
      const tokCode = result.tokens.find(t => t.field === "finish")?.code ?? "";
      return (o.code ?? "") === tokCode || (o.name ?? "").toLowerCase().includes(tokCode.toLowerCase());
    }) ?? null;
    const finFam = finishFamilyFromOption(finOpt);
    if (finFam) fam = finFam.label.toLowerCase();
  }
  if (fin) lines.push(`finish: ${fin}${fam ? ` (${fam})` : ""}`);
  else if (fam) lines.push(`finish family: ${fam}`);
  const cyl = tokenName("cylinder") ?? tokenName("cylinderTech") ?? tokenName("corePrep");
  if (cyl) lines.push(`cylinder: ${cyl}`);
  else if (a.cylinderType.id !== "none" && a.cylinderType.id !== "") lines.push(`cylinder: ${a.cylinderType.label.toLowerCase()}`);
  const latch = tokenName("latch");
  if (latch) lines.push(`latch: ${latch}`);
  return lines;
}
// ─────────────────── Phase B refined: layman query layer (runtime canonical) ───────────────────
// Lead decision (2026-08-11 21:58): the RUNTIME derivation above is the single canonical UUS source
// the app consumes (search/decode/build/constraints all see the same attributes). The static
// uus-attributes.json is an audit/reference export only — app code must NOT read it.
export interface UusLaymanAttributes {
  categories: Set<string>;
  grades: Set<string>;
  functions: Set<string>;
  finishes: Set<string>;
  cylinders: Set<string>;
  styles: Set<string>;
  types: Set<string>;
  features: Set<string>;
  matchedPhrases: string[];
}
export type UusSynonymTarget = Partial<Record<
  "categories" | "grades" | "functions" | "finishes" | "cylinders" | "styles" | "types" | "features",
  string[]
>>;
export interface UusSynonymsFile {
  version?: number;
  phrases: Record<string, UusSynonymTarget>;
}
/** Fresh attribute sets per query — NEVER share Sets across calls (a shared EMPTY_LAYMAN was
 *  mutated in place by out[k].add(), so consecutive searches contaminated each other's tokens). */
function freshLayman(): UusLaymanAttributes {
  return {
    categories: new Set(), grades: new Set(), functions: new Set(), finishes: new Set(),
    cylinders: new Set(), styles: new Set(), types: new Set(), features: new Set(), matchedPhrases: [],
  };
}
/** Map a layman query through the synonym dictionary (/home/team/shared/data/uus-synonyms.json) to UUS attribute tokens. */
export function parseLaymanQuery(query: string, synonyms: UusSynonymsFile | null): UusLaymanAttributes {
  const q = n(query);
  const out: UusLaymanAttributes = freshLayman();
  if (!synonyms || !q) return out;
  const phrases = Object.keys(synonyms.phrases ?? {}).sort((a, b) => b.length - a.length);
  for (const phrase of phrases) {
    if (!phrase) continue;
    if (q.includes(phrase)) {
      const t = synonyms.phrases[phrase];
      for (const k of ["categories", "grades", "functions", "finishes", "cylinders", "styles", "types", "features"] as const) {
        for (const v of t[k] ?? []) out[k].add(v);
      }
      out.matchedPhrases.push(phrase);
    }
  }
  return out;
}
/** Category match with form-override: a "smart deadbolt" (runtime category electronic) IS a deadbolt
 *  form when the product's own name says so, and a "keypad deadbolt" named as such is deadbolt-first. */
export function categoryFormMatches(qCategoryId: string, product: ProductSeries, a: UusAttributes): boolean {
  if (a.category.id === qCategoryId) return true;
  const nameText = n(`${product.name} ${product.series}`);
  if (qCategoryId === "deadbolt" && a.category.id === "electronic" && /dead ?bolt|dead ?latch|deadlock/.test(nameText)) return true;
  if (qCategoryId === "electronic" && a.category.id === "deadbolt" && /smart|keypad|electronic|keyless|wifi|bluetooth|zwave/.test(nameText)) return true;
  if (qCategoryId === "cylindrical" && a.category.id === "electronic" && /lever|knob|cylindrical/.test(nameText)) return true;
  return false;
}
export interface LaymanMatch {
  matched: string[]; // one chip label per matched attribute group
  count: number;
}
/** Does a product's RUNTIME UUS attributes satisfy the parsed layman query? Returns matched chip labels. */
export function matchLayman(product: ProductSeries, q: UusLaymanAttributes, a?: UusAttributes): LaymanMatch {
  const attrs = a ?? deriveUus(product);
  const matched: string[] = [];
  if (q.categories.size) {
    for (const c of q.categories) if (categoryFormMatches(c, product, attrs)) { matched.push(`Category: ${attrs.category.label}`); break; }
  }
  if (q.grades.size && q.grades.has(attrs.grade.id)) matched.push(`Grade: ${attrs.grade.label}`);
  if (q.functions.size) {
    const hit = attrs.functions.find(f => q.functions.has(f.id));
    if (hit) matched.push(`Function: ${hit.label}`);
  }
  if (q.finishes.size) {
    const hit = attrs.finishFamilies.find(f => q.finishes.has(f.id));
    if (hit) matched.push(`Finish: ${hit.label}`);
  }
  if (q.cylinders.size && q.cylinders.has(attrs.cylinderType.id)) matched.push(`Cylinder: ${attrs.cylinderType.label}`);
  if (q.styles.size) {
    if (q.styles.has("knob") && attrs.designStyle.id === "knob") matched.push("Style: Knob");
    else if (q.styles.has("lever") && isLeverForm(product, attrs)) matched.push("Style: Lever");
  }
  if (q.types.size && product.type && q.types.has(product.type)) matched.push(`Type: ${product.type}`);
  if (q.features.size) {
    const sizeText = n(attrs.sizing.join(" ") + " " + (product.description ?? ""));
    const hit = [...q.features].find(f => sizeText.includes(f));
    if (hit) matched.push(`Feature: ${hit}`);
  }
  return { matched: [...new Set(matched)], count: matched.length };
}
