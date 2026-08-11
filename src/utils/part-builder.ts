import type { Selection, ProductSeries, SeriesOption } from "~/types";

/**
 * Human-readable labels for option keys.
 */
const FIELD_LABELS: Record<string, string> = {
  function: "Function",
  style: "Style",
  grade: "Grade",
  finish: "Finish",
  keyway: "Keyway",
  handing: "Handing",
  backset: "Backset",
  backsetCode: "Backset",
  cylinder: "Cylinder",
  cylinderTech: "Cylinder Technology",
  latch: "Latch",
  corePrep: "Core Prep",
  finishCode: "Finish",
  thickKit: "Thick Door Kit",
  keyingTag: "Keying",
  cylinderSize: "Cylinder Size",
  formatCode: "Format",
  design: "Design",
  force: "Force",
  gradeCode: "Grade",
  keysize: "Key Size",
  model: "Model",
  options: "Options",
  product: "Product",
  productCode: "Product",
  series: "Series Code",
  size: "Size",
  tool: "Tool",
  trim: "Trim",
  type: "Type",
  voltage: "Voltage",
  delay: "Delay",
  arm: "Arm",
  cover: "Cover",
  fastener: "Fastener",
  suffix: "Suffix",
  coreType: "Core Type",
  coreSize: "Core Size",
  level: "Level",
  combinatingCode: "Combinating Code",
  coreHousing: "Core Housing",
  shackleHeight: "Shackle Height",
  chain: "Chain",
  stamp: "Stamp",
};

/**
 * Logical display order for option fields.
 */
const FIELD_ORDER: string[] = [
  "function", "trim", "style", "grade", "gradeCode", "delay", "arm", "cover", "fastener",
  "coreType", "coreSize", "level", "combinatingCode", "coreHousing", "shackleHeight", "chain", "stamp",
  "finish", "suffix", "keyway",
  "handing", "backset", "latch", "backsetCode", "cylinderTech", "finishCode", "corePrep", "cylinder", "cylinderSize", "formatCode", "keyingTag", "design", "product", "productCode", "model",
  "type", "size", "doorHeight", "force", "keysize", "voltage", "series",
  "options", "tool",
];

/**
 * Get a human-readable label for an option key.
 */
export function getFieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");
}

/**
 * Get a placeholder for a field.
 */
export function getFieldPlaceholder(key: string): string {
  return `Select ${getFieldLabel(key).toLowerCase()}...`;
}

/**
 * Get the logical display order index for a field key.
 */
export function getFieldOrder(key: string): number {
  const idx = FIELD_ORDER.indexOf(key);
  return idx >= 0 ? idx : FIELD_ORDER.length;
}

/**
 * Build a part number using the per-series partNumberPattern template.
 * Substitutes {fieldName} and {fieldNameCode} with the selected option's code.
 */
export function buildPartNumber(
  selection: Selection,
  series: ProductSeries,
): string {
  const codes: Record<string, string | undefined> = {};

  // Add all selected options by their code
  for (const [key, opt] of Object.entries(selection.options)) {
    if (opt?.code) {
      codes[key] = opt.code;
      codes[`${key}Code`] = opt.code;
    }
  }

  // Add pins
  if (selection.pins) {
    codes.pins = selection.pins.toString();
  }

  let result = series.partNumberPattern;
  for (const [key, code] of Object.entries(codes)) {
    if (code) {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), code);
    }
  }

  // Strip any remaining {placeholders}. A selected option with an empty code
  // (e.g. "No Options") is not added to `codes`, so its placeholder would
  // otherwise leak into the built part number — it must render as nothing.
  result = result.replace(/\{[^}]+\}/g, "");

  return result;
}

/**
 * Build a partial part number — works even when not all fields are selected.
 * Substitutes whatever codes are available and leaves placeholder markers
 * for missing fields.
 */
export function buildPartialPartNumber(
  selection: Selection,
  series: ProductSeries,
): string {
  const codes: Record<string, string | undefined> = {};

  // Add all selected options by their code
  for (const [key, opt] of Object.entries(selection.options)) {
    if (opt?.code) {
      codes[key] = opt.code;
      codes[`${key}Code`] = opt.code;
    }
  }

  // Add pins
  if (selection.pins) {
    codes.pins = selection.pins.toString();
  }

  let result = series.partNumberPattern;
  for (const [key, code] of Object.entries(codes)) {
    if (code) {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), code);
    }
  }

  // Clean up any remaining {placeholders} for readability
  result = result.replace(/\{[^}]+\}/g, "___");

  return result;
}

/**
 * Find cross-references for the built part number from the manufacturer data.
 */
export function findCrossReferences(
  partNumber: string,
  crossReferences: Record<string, Record<string, string>> | undefined,
): Array<{ manufacturer: string; partNumber: string }> {
  if (!crossReferences || !partNumber) return [];
  const matches = crossReferences[partNumber];
  if (!matches) return [];
  return Object.entries(matches).map(([manufacturer, num]) => ({
    manufacturer,
    partNumber: num,
  }));
}

/**
 * Get the fields that should be rendered for this series.
 * Only returns option keys that actually appear in the part number pattern —
 * users shouldn't see dropdowns for fields that don't affect the part number.
 * Falls back to all keys if the pattern has no placeholders.
 */
export function getActiveFields(series: ProductSeries): string[] {
  const allKeys = Object.keys(series.options || {});

  // Extract placeholder names from the pattern: {function}, {finish}, {finishCode}, etc.
  // Match the FULL placeholder name — {finishCode} must map to the option key
  // "finishCode", not to "finish". Capturing the full name keeps Code-suffixed
  // fields (finishCode, backsetCode, formatCode, keyingTag, cylinderSize...) visible.
  const pattern = series.partNumberPattern || "";
  const placeholderRegex = /\{(\w+)\}/g;
  const patternFields = new Set<string>();
  let match;
  while ((match = placeholderRegex.exec(pattern)) !== null) {
    patternFields.add(match[1]);
    // Reset lastIndex since we're reusing the regex
    if (match.index === placeholderRegex.lastIndex) placeholderRegex.lastIndex++;
  }

  // If the pattern references fields, only show those fields
  if (patternFields.size > 0) {
    const keys = allKeys.filter((k) => {
      if (patternFields.has(k)) return true;
      // Safety net: pattern may reference the Code-stripped form ({finish}) while
      // the option key is Code-suffixed (finishCode) or vice versa.
      return patternFields.has(k.replace(/Code$/, "")) || patternFields.has(`${k}Code`);
    });
    // Sort by logical order
    keys.sort((a, b) => getFieldOrder(a) - getFieldOrder(b));
    return keys;
  }

  // No pattern placeholders — show all fields as a fallback
  allKeys.sort((a, b) => getFieldOrder(a) - getFieldOrder(b));
  return allKeys;
}

/**
 * Check if all required fields are selected for the given series.
 */
export function isComplete(selection: Selection): boolean {
  if (!selection.series) return false;
  const activeFields = getActiveFields(selection.series);
  for (const key of activeFields) {
    if (!selection.options[key]) return false;
  }
  // Pin count is required if the selected keyway has multiple pin options
  const keyway = selection.options.keyway;
  if (keyway?.availablePins && keyway.availablePins.length > 1 && !selection.pins) return false;
  return true;
}

/**
 * Get the count of total selectable fields and the count of selected fields.
 */
export function getFieldCounts(series: ProductSeries | null, selection: Selection): { total: number; selected: number } {
  if (!series) return { total: 0, selected: 0 };

  const activeFields = getActiveFields(series);
  let total = activeFields.length;
  let selected = activeFields.filter((key) => selection.options[key] !== null && selection.options[key] !== undefined).length;

  // Pin count is required if the selected keyway has multiple pin options
  const keyway = selection.options.keyway;
  if (keyway?.availablePins && keyway.availablePins.length > 1) {
    total += 1;
    if (selection.pins !== null) selected += 1;
  }

  return { total, selected };
}