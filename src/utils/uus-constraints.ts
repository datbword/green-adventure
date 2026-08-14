/**
 * UUS Phase C — Cross-Brand Validation Loop (2026-08-11, owner spec rev).
 *
 * Owner architecture: EXTRACT → EVALUATE → EXECUTE, bounded correction loop.
 *
 *   evaluateState(state, constraints) → { correctedState, corrections, blocked, messages }
 *
 *   1. EXTRACT  — the current build selection mapped to UUS attribute values
 *                 (category/grade/function/style/finish/cylinder + product option fields).
 *   2. EVALUATE — for each ACTIVE row of the centralized Constraint_Table
 *                 (constraint-table.json), the conflict fires when BOTH
 *                 uus_attribute_a and uus_attribute_b are present in state.
 *   3. EXECUTE  — apply resolution_action:
 *                   CHANGE_VALUE / UPGRADE_VALUE / FORCE_CHANGE: set resolution_target field/value
 *                   REMOVE: clear attribute_b's option
 *                 Each correction surfaces row.user_message. A fired conflict with no actionable
 *                 resolution → blocked:true (part-number generation is prevented).
 *   Loop until stable — corrections can trigger NEW conflicts (bounded at 5 iterations; then block).
 *
 * Honesty rule (owner, 2026-08-11): the shipped Constraint_Table seeds the owner's 6 mock rows ALL
 * active:false + data-reality notes. Live enforcement derives ONLY from (a) product data files and
 * (b) rows the owner has confirmed. NO fabricated constraints. All availability/correction logic
 * below reads the real data files.
 *
 * Canonical UUS source: all attributes consumed via src/utils/uus.ts API (deriveUus / uusFileEntry /
 * translateDecoded) — NOT by reading uus-attributes.json directly in new code paths.
 */
import { deriveUus, categoryFormMatches, type UusAttributes } from "~/utils/uus";
import { findUusCandidates, styleMatches, mapUusSelection, type UusBuildSelection, type UusCandidate } from "~/utils/uus-build";
import type { ManufacturerData, ProductSeries, SeriesOption } from "~/types";

// ─────────────────────────────── Constraint_Table schema (owner) ───────────────────────────────

export type ConstraintCondition = "CANNOT_COMBINE_WITH";
export type ResolutionAction = "CHANGE_VALUE" | "UPGRADE_VALUE" | "REMOVE" | "FORCE_CHANGE";

/** One side of a constraint: {category, field, value}. `category` is the product category scope
 *  the constraint lives in (e.g. "Cylindrical", "Surface_Closer"); `field` is the attribute field
 *  (UUS field like grade/function/finish/cylinder/category, OR a product option field like
 *  cover/option/keyway/arm/mounting_style); `value` is the participating value. */
export interface ConstraintAttrRef {
  category?: string;
  field: string;
  value: string;
}

export interface ConstraintRow {
  id: string;
  brand?: string | null; // manufacturer file id (e.g. "schlage"); null/undefined = any brand
  uus_attribute_a: ConstraintAttrRef;
  condition: ConstraintCondition;
  uus_attribute_b: ConstraintAttrRef;
  resolution_action: ResolutionAction;
  resolution_target?: { field: string; value: string } | null; // required for CHANGE_VALUE/UPGRADE_VALUE/FORCE_CHANGE
  user_message: string;
  active: boolean;
  notes?: string;
}

export interface ConstraintTable {
  _meta?: Record<string, unknown>;
  rows: ConstraintRow[];
}

export const UUS_FIELDS = ["category", "grade", "function", "style", "finish", "cylinder"] as const;
export type UusField = (typeof UUS_FIELDS)[number];

/** The evaluated state: brand + UUS attribute values + selected product option fields. */
export interface ConstraintState {
  brand?: string;
  attributes: Record<string, string>; // field → value (UUS ids + product option codes)
}

// ─────────────────────────────── 1. Extract State ───────────────────────────────

const norm = (s: string): string => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();

/**
 * Extract the constraint state from the current UUS build selection (+ brand + product options).
 * UUS fields are included under their own names; product option fields (cover, keyway, arm, …)
 * are included as selected codes so option-level constraint rows can match.
 */
export function extractConstraintState(
  uusSel: UusBuildSelection,
  brand?: string | null,
  options: Record<string, SeriesOption | null> = {},
): ConstraintState {
  const attributes: Record<string, string> = {};
  for (const f of UUS_FIELDS) {
    const v = uusSel[f];
    if (v) attributes[f] = v;
  }
  for (const [field, opt] of Object.entries(options)) {
    if (opt) attributes[field] = opt.code ?? opt.name ?? "";
  }
  return { brand: brand ?? undefined, attributes };
}

/** Is an attribute ref present in the state? (category scope matches AND field value matches) */
export function attrPresent(state: ConstraintState, ref: ConstraintAttrRef): boolean {
  if (ref.category) {
    const cat = state.attributes["category"];
    if (!cat || norm(cat) !== norm(ref.category)) return false;
  }
  const v = state.attributes[ref.field];
  return v !== undefined && v !== "" && norm(v) === norm(ref.value);
}

/** Which active rows fire against the state? (EVALUATE step, shared by evaluateState/evaluateConstraints) */
export function firedRows(state: ConstraintState, table: ConstraintTable | null): ConstraintRow[] {
  if (!table?.rows) return [];
  const out: ConstraintRow[] = [];
  for (const row of table.rows) {
    if (!row.active) continue;
    if (row.brand && state.brand && norm(row.brand) !== norm(state.brand)) continue;
    if (attrPresent(state, row.uus_attribute_a) && attrPresent(state, row.uus_attribute_b)) {
      out.push(row);
    }
  }
  return out;
}

export interface ConstraintViolation {
  row: ConstraintRow;
  message: string;
  blocked: boolean;
}

/** EVALUATE only — returns fired rows (used by the UI memo / tests). */
export function evaluateConstraints(state: ConstraintState, table: ConstraintTable | null): ConstraintViolation[] {
  return firedRows(state, table).map((row) => ({
    row,
    message: row.user_message || `"${row.uus_attribute_a.value}" can't combine with "${row.uus_attribute_b.value}"`,
    blocked: false, // resolution is evaluated separately (evaluateState); this is the raw EVALUATE step
  }));
}

// ─────────────────────────────── 3. Execute Correction ───────────────────────────────

export interface ConstraintCorrection {
  field: string;
  from: string;
  to: string;
  message: string;
  forced?: boolean;  // FORCE_CHANGE recorded
  upgraded?: boolean; // UPGRADE_VALUE recorded (owner priority marker)
}

export interface EvaluateResult {
  correctedState: ConstraintState;
  corrections: ConstraintCorrection[];
  blocked: boolean;
  messages: string[];
}

const MAX_ITERATIONS = 5;

/** Apply ONE resolution to the state; returns {changed, state, correction} or {blocked, message}. */
function applyResolution(
  state: ConstraintState,
  row: ConstraintRow,
): { changed: boolean; state?: ConstraintState; correction?: ConstraintCorrection; blocked?: boolean; message?: string } {
  const a = row.uus_attribute_a;
  const b = row.uus_attribute_b;
  switch (row.resolution_action) {
    case "CHANGE_VALUE":
    case "UPGRADE_VALUE":
    case "FORCE_CHANGE": {
      const target = row.resolution_target;
      if (!target || !target.field) {
        return { changed: false, blocked: true, message: row.user_message || "No resolution target for this conflict." };
      }
      const from = state.attributes[target.field] ?? "";
      const correctedState: ConstraintState = { ...state, attributes: { ...state.attributes, [target.field]: target.value } };
      return {
        changed: norm(from) !== norm(target.value),
        state: correctedState,
        correction: {
          field: target.field,
          from,
          to: target.value,
          message: row.user_message || `"${from}" isn't available — using "${target.value}" instead.`,
          forced: row.resolution_action === "FORCE_CHANGE",
          upgraded: row.resolution_action === "UPGRADE_VALUE",
        },
      };
    }
    case "REMOVE": {
      const from = state.attributes[b.field];
      if (from === undefined) {
        // attribute_b's option isn't actually present — nothing actionable
        return { changed: false, blocked: true, message: row.user_message || "Cannot resolve: option already absent." };
      }
      const correctedState: ConstraintState = { ...state, attributes: { ...state.attributes } };
      delete correctedState.attributes[b.field];
      return {
        changed: true,
        state: correctedState,
        correction: { field: b.field, from, to: "", message: row.user_message || `Removed "${b.value}".` },
      };
    }
    default:
      return { changed: false, blocked: true, message: row.user_message || "Unknown resolution action." };
  }
}

/**
 * The owner-specified validation loop.
 * EXTRACT (state) → EVALUATE (firedRows) → EXECUTE (applyResolution), looping until stable.
 * Corrections can trigger new conflicts — bounded at MAX_ITERATIONS; if conflicts remain after the
 * bound, blocked:true with a "could not resolve" message. Any fired conflict with no actionable
 * resolution → blocked:true immediately (part-number generation prevented).
 */
export function evaluateState(state: ConstraintState, table: ConstraintTable | null): EvaluateResult {
  if (!table?.rows || table.rows.length === 0) {
    return { correctedState: state, corrections: [], blocked: false, messages: [] };
  }
  let current: ConstraintState = { ...state, attributes: { ...state.attributes } };
  const corrections: ConstraintCorrection[] = [];
  const messages: string[] = [];
  let blocked = false;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const conflicts = firedRows(current, table);
    if (conflicts.length === 0) break;
    let progressed = false;
    for (const row of conflicts) {
      const res = applyResolution(current, row);
      if (res.blocked) {
        blocked = true;
        messages.push(res.message ?? row.user_message);
        continue;
      }
      if (res.changed && res.state && res.correction) {
        current = res.state;
        corrections.push(res.correction);
        messages.push(res.correction.message);
        progressed = true;
      }
    }
    if (blocked) break;
    if (!progressed) {
      // conflicts remain but no resolution made progress → unresolvable
      blocked = true;
      messages.push("Could not resolve the conflicting options automatically — try changing your selection.");
      break;
    }
  }

  if (!blocked && firedRows(current, table).length > 0) {
    blocked = true;
    messages.push("Could not resolve all conflicts within the correction loop limit — try changing your selection.");
  }

  return { correctedState: current, corrections, blocked, messages };
}

// ─────────────────────────────── Interlocking availability (data-derived) ───────────────────────────────

/** Does a product fully match EVERY selected UUS field? (stricter than findUusCandidates' any-match) */
export function fullMatch(product: ManufacturerData["products"][number], sel: UusBuildSelection): boolean {
  const a = deriveUus(product);
  if (sel.category && !categoryFormMatches(sel.category, product, a)) return false;
  if (sel.grade && a.grade.id !== sel.grade) return false;
  if (sel.function && !a.functions.some((f) => f.id === sel.function)) return false;
  if (sel.style && !styleMatches(sel.style, product, a)) return false;
  if (sel.finish && !a.finishFamilies.some((f) => f.id === sel.finish)) return false;
  if (sel.cylinder && a.cylinderType.id !== sel.cylinder) return false;
  return true;
}

/** Count products fully matching a UUS selection (0 = the combination is impossible in the catalog). */
export function countFullMatches(manufacturerFiles: Record<string, ManufacturerData>, sel: UusBuildSelection): number {
  let n = 0;
  for (const data of Object.values(manufacturerFiles)) {
    for (const product of data.products) if (fullMatch(product, sel)) n++;
  }
  return n;
}

/**
 * Interlocking: for a given field, which values remain AVAILABLE given the current other selections?
 * A value is available iff ≥1 product in the catalog fully matches all other fields PLUS that value.
 * Values outside the returned set must be grayed out (disabled) in the dropdown.
 */
export function getAvailableValues(
  manufacturerFiles: Record<string, ManufacturerData>,
  uusSel: UusBuildSelection,
  field: UusField,
  domain: string[],
): Set<string> {
  const available = new Set<string>();
  for (const v of domain) {
    const base = { ...uusSel };
    delete (base as Record<string, string | undefined>)[field];
    const trialSel = { ...base, [field]: v };
    if (countFullMatches(manufacturerFiles, trialSel) > 0) available.add(v);
  }
  return available;
}

/**
 * Interlocking by ACTIVE constraint rows: which candidate values of `field` would trigger a
 * correction or a block if selected? Those must be grayed out too. With 0 active rows this is empty.
 */
export function getConstraintForbiddenValues(
  table: ConstraintTable | null,
  state: ConstraintState,
  field: string,
  domain: string[],
): Set<string> {
  const forbidden = new Set<string>();
  if (!table?.rows?.some((r) => r.active)) return forbidden;
  for (const v of domain) {
    const trial: ConstraintState = { ...state, attributes: { ...state.attributes, [field]: v } };
    const res = evaluateState(trial, table);
    if (res.blocked || res.corrections.length > 0) forbidden.add(v);
  }
  return forbidden;
}

// ─────────────────────────────── Auto-correction (data-derived, preserves user goal) ───────────────────────────────

export interface AutoCorrection {
  field: string;
  from: string;
  to: string;
  message: string;
}

export interface CorrectionResult {
  selection: UusBuildSelection;
  corrections: AutoCorrection[]; // toast messages for the user
  blocked: boolean;              // true = hard block (do NOT generate a part number)
  blockMessage?: string;
}

/** Domain orders for auto-correction — prefer the value closest to the user's intent (satin over bright, heavier duty first). */
const GRADE_ORDER = ["1", "2", "3", "residential"];
const FINISH_ORDER = ["chrome", "brass", "bronze", "stainless", "nickel", "black", "gold", "aluminum"];
const CYLINDER_ORDER = ["conventional", "sf-ic", "lf-ic", "keyed-removable", "electronic"];
const STYLE_ORDER = ["straight", "curved", "flat", "ornate", "knob"];

function fieldDomain(field: UusField): string[] {
  switch (field) {
    case "grade": return GRADE_ORDER;
    case "finish": return FINISH_ORDER;
    case "cylinder": return CYLINDER_ORDER;
    case "style": return STYLE_ORDER;
    default: return [];
  }
}

/**
 * Auto-correct a selection change. When the user picks a value that makes the full combination
 * impossible (0 matching products), try changing ONE other field (priority: grade → finish → cylinder
 * → style) to a value that restores ≥1 match — prioritizing the user's goal (the option they just
 * picked stays fixed; e.g. "upgrade grade to keep Storeroom"). If nothing restores a match, the
 * selection is HARD-BLOCKED (no part number can be generated).
 */
export function autoCorrectSelection(
  manufacturerFiles: Record<string, ManufacturerData>,
  uusSel: UusBuildSelection,
  changedField: UusField,
): CorrectionResult {
  if (countFullMatches(manufacturerFiles, uusSel) > 0) {
    return { selection: uusSel, corrections: [], blocked: false };
  }
  const otherFields: UusField[] = ["grade", "finish", "cylinder", "style", "function"].filter((f) => f !== changedField && f !== "category") as UusField[];
  for (const field of otherFields) {
    const current = (uusSel as Record<string, string | undefined>)[field];
    const domain = fieldDomain(field);
    for (const candidate of domain) {
      if (candidate === current) continue;
      const trial: UusBuildSelection = { ...uusSel, [field]: candidate };
      if (countFullMatches(manufacturerFiles, trial) > 0) {
        const label = field.charAt(0).toUpperCase() + field.slice(1);
        return {
          selection: trial,
          corrections: [{
            field,
            from: current ?? "",
            to: candidate,
            message: `${label} "${current ?? "—"}" isn't available with your other choices — using "${candidate}" instead.`,
          }],
          blocked: false,
        };
      }
    }
  }
  const selected = Object.entries(uusSel).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(", ");
  return {
    selection: uusSel,
    corrections: [],
    blocked: true,
    blockMessage: `No product matches ${selected || "those choices"} — try removing an attribute.`,
  };
}

// ─────────────────────────────── Mapping validation (hard block on generation) ───────────────────────────────

export interface MappingValidation {
  ok: boolean;
  corrections: AutoCorrection[];        // applied auto-corrections (toasts)
  blocked: boolean;
  blockMessage?: string;
  missing: { field: string; label: string }[]; // selections the product genuinely doesn't offer
}

/** Selections the product's RUNTIME-derived UUS attributes don't include (data-provable mismatch). */
function derivedMissingFor(product: ProductSeries, sel: UusBuildSelection): { field: string; label: string }[] {
  const a = deriveUus(product);
  const out: { field: string; label: string }[] = [];
  if (sel.function && !a.functions.some((f) => f.id === sel.function)) {
    out.push({ field: "function", label: sel.function });
  }
  if (sel.grade && a.grade.id !== sel.grade) {
    out.push({ field: "grade", label: sel.grade });
  }
  if (sel.cylinder && a.cylinderType.id !== sel.cylinder) {
    out.push({ field: "cylinder", label: sel.cylinder });
  }
  return out;
}

/**
 * Validate mapping a candidate product onto the current UUS selection. If a SELECTED attribute has no
 * real option on the product (mapUusSelection.missing), try to auto-correct it to an available value;
 * if none exists → HARD BLOCK: do not populate the builder (no invalid part number can be generated).
 */
export function validateUusMapping(
  candidate: UusCandidate,
  uusSel: UusBuildSelection,
): MappingValidation {
  const mapping = mapUusSelection(candidate.product, uusSel);
  // Runtime-derived cross-check (data-provable): a product whose derived UUS attributes don't include
  // a selected function/grade/cylinder cannot satisfy that selection, even if it has no option field
  // for it (e.g. a fixed-function passage lever — no "function" options array at all).
  const missing = [...mapping.missing, ...derivedMissingFor(candidate.product, uusSel)];
  if (missing.length === 0) {
    return { ok: true, corrections: [], blocked: false, missing: [] };
  }
  const corrected: UusBuildSelection = { ...uusSel };
  const corrections: AutoCorrection[] = [];
  const stillMissing: { field: string; label: string }[] = [];
  for (const m of missing) {
    const field = m.field as UusField;
    const current = (uusSel as Record<string, string | undefined>)[field];
    // Core intent (function/category) is NEVER auto-corrected on candidate pick — a storeroom request
    // must not silently produce a passage part number. Only adjustable attributes (grade/finish/
    // cylinder/style) can be corrected; everything else hard-blocks.
    if (!current || field === "function" || field === "category") { stillMissing.push(m); continue; }
    const domain = fieldDomain(field);
    let fixed = false;
    for (const candidateValue of domain) {
      if (candidateValue === current) continue;
      const trial: UusBuildSelection = { ...corrected, [field]: candidateValue };
      const trialMapping = mapUusSelection(candidate.product, trial);
      const trialMissing = [
        ...trialMapping.missing,
        ...derivedMissingFor(candidate.product, trial),
      ].filter((x) => x.field === field);
      if (trialMissing.length === 0) {
        corrected[field as keyof UusBuildSelection] = candidateValue as never;
        corrections.push({
          field,
          from: current,
          to: candidateValue,
          message: `"${m.label}" isn't offered on ${candidate.product.name} — using "${candidateValue}" instead.`,
        });
        fixed = true;
        break;
      }
    }
    if (!fixed) stillMissing.push(m);
  }
  if (stillMissing.length > 0) {
    return {
      ok: false,
      corrections,
      blocked: true,
      blockMessage: `${candidate.product.name} doesn't offer ${stillMissing.map((m) => m.label).join(", ")} — pick a different series or change the selection.`,
      missing: stillMissing,
    };
  }
  return { ok: true, corrections, blocked: false, missing: [] };
}

// keep findUusCandidates re-exported for callers that want both layers
export { findUusCandidates };
