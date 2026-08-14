/**
 * UUS Build (Simple build) — owner spec function 3: UUS Attributes → Valid Orderable Part Number.
 * (2026-08-11, Phase B refined). Canonical attribute source = RUNTIME deriveUus() (src/utils/uus.ts);
 * option mapping uses ONLY real option codes from the target product's own data file (no fabrication).
 */
import { deriveUus, mapFunctionKeyword, finishFamilyFromOption, categoryFormMatches, type UusAttributes } from "~/utils/uus";
import type { ManufacturerData, ProductSeries, SeriesOption } from "~/types";

/** UUS attribute selections for the Simple build. Ids match deriveUus() ids. */
export interface UusBuildSelection {
  category?: string; // e.g. "cylindrical" | "mortise" | "deadbolt" | ...
  grade?: string;    // "1" | "2" | "3" | "residential"
  function?: string; // e.g. "storeroom" | "classroom" | "passage" | ...
  style?: string;    // "straight" | "curved" | "flat" | "ornate" | "knob"
  finish?: string;   // finish family id e.g. "chrome" | "brass" | "bronze" | ...
  cylinder?: string; // "sf-ic" | "lf-ic" | "conventional" | "electronic" | "keyed-removable"
}

export interface UusCandidate {
  manufacturerId: string;
  manufacturerName: string;
  product: ProductSeries;
  attrs: UusAttributes;
  matched: string[];
}

function styleOptionBucket(o: SeriesOption): string | null {
  const t = `${o.name ?? ""} ${o.code ?? ""} ${o.description ?? ""}`.toLowerCase();
  if (/sierra|straight|standard|traditional|classic|colonial|victorian/.test(t)) return "straight";
  if (/sonnet|curve|contour|crescent|rounded/.test(t)) return "curved";
  if (/broadway|flat|modern|minimal|square|linear/.test(t)) return "flat";
  if (/abbey|athena|augusta|florentine|venetian|craftsman|mission|decorative|designer|ornate|royal|elegant/.test(t)) return "ornate";
  if (/knob|ball|round|oval|egg|crystal/.test(t)) return "knob";
  return null;
}

export function styleMatches(selStyle: string, product: ProductSeries, a: UusAttributes): boolean {
  if (selStyle === "knob") return a.designStyle.id === "knob" || /knob/.test(`${product.name} ${product.series}`.toLowerCase());
  // lever and silhouette buckets: product is a lever form
  const nameText = `${product.name} ${product.series}`.toLowerCase();
  if (!/lever|cylindrical|mortise/.test(nameText) && a.designStyle.id === "none") return false;
  if (selStyle === "lever") return a.designStyle.id !== "knob" && a.designStyle.id !== "none" && /lever|cylindrical/.test(nameText);
  return a.designStyle.id === selStyle;
}

/** Find candidate products (across ALL brands) whose RUNTIME UUS attributes match the selections. */
export function findUusCandidates(
  manufacturerFiles: Record<string, ManufacturerData>,
  sel: UusBuildSelection,
): UusCandidate[] {
  const out: UusCandidate[] = [];
  for (const [mfrId, data] of Object.entries(manufacturerFiles)) {
    for (const product of data.products) {
      const a = deriveUus(product);
      const matched: string[] = [];
      if (sel.category && categoryFormMatches(sel.category, product, a)) matched.push(a.category.label);
      if (sel.grade && a.grade.id === sel.grade) matched.push(a.grade.label);
      if (sel.function) {
        const hit = a.functions.find(f => f.id === sel.function);
        if (hit) matched.push(hit.label);
      }
      if (sel.style && styleMatches(sel.style, product, a)) matched.push(a.designStyle.label);
      if (sel.finish) {
        const hit = a.finishFamilies.find(f => f.id === sel.finish);
        if (hit) matched.push(hit.label);
      }
      if (sel.cylinder && a.cylinderType.id === sel.cylinder) matched.push(a.cylinderType.label);
      if (matched.length > 0) out.push({ manufacturerId: mfrId, manufacturerName: data.manufacturer, product, attrs: a, matched: [...new Set(matched)] });
    }
  }
  out.sort((x, y) => y.matched.length - x.matched.length);
  return out;
}

function cylinderOptionMatches(o: SeriesOption, selCylinder: string): boolean {
  const t = `${o.code ?? ""} ${o.name ?? ""} ${o.description ?? ""}`.toLowerCase();
  switch (selCylinder) {
    case "sf-ic": return /\bsfic\b|small format|interchangeable core|\bic\b/.test(t) && !/large format|lf ?ic|\blfic\b/.test(t);
    case "lf-ic": return /large format|\blfic\b|\bsic\b/.test(t);
    case "keyed-removable": return /\bkil\b|keyed.?removable/.test(t);
    case "electronic": return /smart|keypad|electronic|keyless|bluetooth|zwave|wifi|access control|proximity|card reader|biometric/.test(t);
    case "conventional": return /standard|conventional|fixed|keyed|schlage c|\bcs\b/.test(t) || (!t && (o.code ?? "") === "");
    case "none": return !t || /none|n\/a/.test(t);
    default: return false;
  }
}

export interface UusBuildMapping {
  optionValues: Record<string, string>;
  optionObjects: Record<string, SeriesOption>;
  missing: { field: string; label: string }[];
}

/** Map UUS selections onto the chosen product's REAL option fields (factory codes only). */
export function mapUusSelection(product: ProductSeries, sel: UusBuildSelection): UusBuildMapping {
  const optionValues: Record<string, string> = {};
  const optionObjects: Record<string, SeriesOption> = {};
  const missing: { field: string; label: string }[] = [];
  const pick = (field: string, pred: (o: SeriesOption) => boolean, label: string, fieldExists: boolean) => {
    const opts = product.options?.[field] ?? [];
    const hit = opts.find(pred) ?? null;
    if (hit) {
      optionValues[field] = hit.code ?? "";
      optionObjects[field] = hit;
    } else if (fieldExists && opts.length > 0) {
      missing.push({ field, label });
    }
  };
  if (sel.function) {
    const label = sel.function;
    pick("function", o => mapFunctionKeyword(o.name ?? "") === label || mapFunctionKeyword(o.code ?? "") === label, label, true);
  }
  if (sel.finish) {
    const label = sel.finish;
    const opts = product.options?.["finish"] ?? [];
    const fam = opts.filter(o => finishFamilyFromOption(o)?.id === label);
    // within a family, prefer the satin/brushed variant (industry-default commercial spec, e.g. 626 over 625)
    const satin = fam.find(o => /satin|brushed/.test(`${o.name ?? ""} ${o.code ?? ""}`.toLowerCase())) ?? fam[0] ?? null;
    if (satin) {
      optionValues["finish"] = satin.code ?? "";
      optionObjects["finish"] = satin;
    } else if (opts.length > 0) {
      missing.push({ field: "finish", label });
    }
  }
  if (sel.style) {
    const label = sel.style;
    pick("style", o => styleOptionBucket(o) === label, label, true);
  }
  if (sel.cylinder) {
    const cylFields = ["cylinder", "corePrep", "coreType", "cylinderPrep", "core", "cylinderTech", "keying"];
    let matchedField = false;
    let anyField = false;
    for (const f of cylFields) {
      const opts = product.options?.[f] ?? [];
      if (!opts.length) continue;
      anyField = true;
      const hit = opts.find(o => cylinderOptionMatches(o, sel.cylinder!));
      if (hit) {
        optionValues[f] = hit.code ?? "";
        optionObjects[f] = hit;
        matchedField = true;
        break;
      }
    }
    if (!matchedField && anyField) missing.push({ field: "cylinder", label: sel.cylinder });
  }
  return { optionValues, optionObjects, missing };
}
