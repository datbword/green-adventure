/**
 * UUS Phase C — Cross-Brand Validation Loop (2026-08-11).
 *
 * Owner architecture: Extract State → Evaluate Constraints → Execute Correction.
 *
 *   1. ExtractState        — current UUS build selections (+ optional brand) → ConstraintState
 *   2. EvaluateConstraints — ACTIVE rows of the centralized Constraint_Table (constraint-table.json)
 *                            fire when both uus_attribute_a and uus_attribute_b are present in state;
 *                            PLUS data-derived interlocking (a value is unavailable when zero products
 *                            support it given the other selections) and mapping validation.
 *   3. ExecuteCorrection   — apply resolution_action/resolution_target (auto-correct the selection,
 *                            prioritizing the user's goal — e.g. upgrade grade to keep an option),
 *                            surface toast messages, and HARD-BLOCK invalid part-number generation.
 *
 * Honesty rule (owner, 2026-08-11): the Constraint_Table seeds the owner's 6 mock rows ALL
 * active:false + data-reality notes. Live enforcement is derived ONLY from the product data files —
 * no fabricated constraints. All availability/correction logic below reads the real data.
 */
import { deriveUus, categoryFormMatches, type UusAttributes } from "~/utils/uus";
import { findUusCandidates, styleMatches, mapUusSelection, type UusBuildSelection, type UusCandidate } from "~/utils/uus-build";
import type { ManufacturerData } from "~/types";

// ─────────────────────────────── Constraint_Table schema (owner) ───────────────────────────────

export type ConstraintCondition = "CANNOT_COMBINE_WITH";
export type ResolutionAction = "CLEAR_ATTRIBUTE_A" | "CLEAR_ATTRIBUTE_B" | "CHANGE_ATTRIBUTE_A" | "CHANGE_ATTRIBUTE_B" | "HARD_BLOCK";

export interface ConstraintRow {
  id: string;
  brand?: string | null;        // manufacturer file id (e.g. "schlage"); null/undefined = any brand
  uus_attribute_a: string;      // "field:value" e.g. "grade:1"
  condition: ConstraintCondition;
  uus_attribute_b: string;      // "field:value" e.g. "function:storeroom"
  resolution_action: ResolutionAction;
  resolution_target?: string | null; // "field:value" for CHANGE_* actions
  user_message: string;
  active: boolean;
  note?: string;
}

export interface ConstraintTable {
  _meta?: Record<string, unknown>;
  rows: ConstraintRow[];
}

export const UUS_FIELDS = ["category", "grade", "function", "style", "finish", "cylinder"] as const;
export type UusField = (typeof UUS_FIELDS)[number];

export interface ConstraintState {
  brand?: string;               // manufacturer id
  category?: string;
  grade?: string;
  function?: string;
  style?: string;
  finish?: string;
  cylinder?: string;
}

// ─────────────────────────────── 1. Extract State ───────────────────────────────

export function extractConstraintState(uusSel: UusBuildSelection, brand?: string | null): ConstraintState {
  return {
    brand: brand ?? undefined,
    category: uusSel.category,
    grade: uusSel.grade,
    function: uusSel.function,
    style: uusSel.style,
    finish: uusSel.finish,
    cylinder: uusSel.cylinder,
  };
}

function parseAttr(ref: string): { field: string; value: string } {
  const i = ref.indexOf(":");
  if (i <= 0) return { field: ref, value: "" };
  return { field: ref.slice(0, i), value: ref.slice(i + 1) };
}

// ─────────────────────────────── 2. Evaluate Constraints ───────────────────────────────

export interface ConstraintViolation {
  row: ConstraintRow;
  message: string;
  blocked: boolean; // true when resolution_action is HARD_BLOCK (or no correction possible)
}

/** Evaluate ACTIVE table rows against the current state. */
export function evaluateConstraints(state: ConstraintState, table: ConstraintTable | null): ConstraintViolation[] {
  if (!table) return [];
  const out: ConstraintViolation[] = [];
  for (const row of table.rows ?? []) {
    if (!row.active) continue;
    if (row.brand && state.brand && row.brand !== state.brand) continue;
    const a = parseAttr(row.uus_attribute_a);
    const b = parseAttr(row.uus_attribute_b);
    const aVal = (state as Record<string, string | undefined>)[a.field];
    const bVal = (state as Record<string, string | undefined>)[b.field];
    if (aVal !== undefined && bVal !== undefined && aVal === a.value && bVal === b.value) {
      out.push({ row, message: row.user_message || `"${a.value}" can't combine with "${b.value}"`, blocked: row.resolution_action === "HARD_BLOCK" });
    }
  }
  return out;
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

const FIELD_VALUE_KEYS: Record<UusField, string> = {
  category: "category", grade: "grade", function: "function", style: "style", finish: "finish", cylinder: "cylinder",
};

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
    const trial: UusBuildSelection = { ...uusSel, [field]: v };
    // drop same-field value from the trial base so "other selections" is the base
    const base = { ...uusSel };
    delete (base as Record<string, string | undefined>)[field];
    const trialSel = { ...base, [field]: v };
    if (countFullMatches(manufacturerFiles, trialSel) > 0) available.add(v);
    void trial;
  }
  return available;
}

// ─────────────────────────────── 3. Execute Correction ───────────────────────────────

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
const FUNCTION_ORDER = ["passage", "privacy", "entrance", "office", "storeroom", "classroom", "classroom-security", "communicating", "dummy", "deadbolt", "panic-exit", "closer", "operator", "electronic"];

function fieldDomain(field: UusField): string[] {
  switch (field) {
    case "grade": return GRADE_ORDER;
    case "finish": return FINISH_ORDER;
    case "cylinder": return CYLINDER_ORDER;
    case "style": return STYLE_ORDER;
    case "function": return FUNCTION_ORDER;
    default: return [];
  }
}

/**
 * Auto-correct a selection change. When the user picks a value that makes the full combination
 * impossible (0 matching products), try changing ONE other field (priority: grade → finish → cylinder
 * → style → function) to a value that restores ≥1 match — prioritizing the user's goal (the option
 * they just picked stays fixed; e.g. "upgrade grade to keep Storeroom"). If nothing restores a match,
 * the selection is HARD-BLOCKED (no part number can be generated).
 */
export function autoCorrectSelection(
  manufacturerFiles: Record<string, ManufacturerData>,
  uusSel: UusBuildSelection,
  changedField: UusField,
): CorrectionResult {
  if (countFullMatches(manufacturerFiles, uusSel) > 0) {
    return { selection: uusSel, corrections: [], blocked: false };
  }
  // Try correcting the OTHER fields (never the just-changed one first — that's the user's goal).
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
  // No single-field correction works → hard block.
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
function derivedMissingFor(product: ManufacturerData["products"][number], sel: UusBuildSelection): { field: string; label: string }[] {
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
  // Try auto-correcting each missing field to the closest available value on THIS product.
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
