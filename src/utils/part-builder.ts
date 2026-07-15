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
};

/**
 * Logical display order for option fields.
 */
const FIELD_ORDER: string[] = [
  "function", "style", "grade", "gradeCode", "finish", "keyway",
  "handing", "backset", "design", "product", "productCode", "model",
  "type", "trim", "size", "force", "keysize", "voltage", "series",
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
 * Returns ALL option keys from the series, in a logical display order.
 */
export function getActiveFields(series: ProductSeries): string[] {
  const keys = Object.keys(series.options || {});
  // Sort by logical order
  keys.sort((a, b) => getFieldOrder(a) - getFieldOrder(b));
  return keys;
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