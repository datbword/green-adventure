import type { Selection, ProductSeries } from "~/types";

/**
 * Build a part number using the per-series partNumberPattern template.
 * Substitutes {functionCode}, {styleCode}, {gradeCode}, {finish}, {keyway}, {handing}, {backset}
 * with the selected codes. Missing codes are skipped (not substituted).
 */
export function buildPartNumber(
  selection: Selection,
  series: ProductSeries,
): string {
  const codes: Record<string, string | undefined> = {
    functionCode: selection.function?.code,
    styleCode: selection.style?.code,
    gradeCode: selection.grade?.code,
    finish: selection.finish?.code,
    keyway: selection.keyway?.code,
    handing: selection.handing?.code,
    backset: selection.backset?.code,
    pins: selection.pins?.toString(),
  };

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
 * for missing fields. For example: "ND{functionCode}-{finish}" with only
 * function selected becomes "ND10-{finish}".
 */
export function buildPartialPartNumber(
  selection: Selection,
  series: ProductSeries,
): string {
  const codes: Record<string, string | undefined> = {
    functionCode: selection.function?.code,
    styleCode: selection.style?.code,
    gradeCode: selection.grade?.code,
    finish: selection.finish?.code,
    keyway: selection.keyway?.code,
    handing: selection.handing?.code,
    backset: selection.backset?.code,
    pins: selection.pins?.toString(),
  };

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
 * Handing is optional — only included if the series has handing options.
 * Style and Grade are included if they exist in the series options.
 */
export function getActiveFields(series: ProductSeries): Array<keyof Selection> {
  const fields: Array<keyof Selection> = [];

  fields.push("function");

  if (series.options.style && series.options.style.length > 0) {
    fields.push("style");
  }
  if (series.options.grade && series.options.grade.length > 0) {
    fields.push("grade");
  }

  fields.push("finish");
  fields.push("keyway");

  if (series.options.handing && series.options.handing.length > 0) {
    fields.push("handing");
  }

  fields.push("backset");

  return fields;
}

/**
 * Check if all required fields are selected for the given series.
 * Handing is optional — only required if handling options exist.
 * Style and Grade are optional — only required if they exist.
 */
export function isComplete(selection: Selection): boolean {
  if (!selection.series) return false;
  if (!selection.function) return false;
  if (!selection.finish) return false;
  if (!selection.keyway) return false;
  if (!selection.backset) return false;

  if (selection.series.options.style && selection.series.options.style.length > 0 && !selection.style) return false;
  if (selection.series.options.grade && selection.series.options.grade.length > 0 && !selection.grade) return false;

  // Handing is optional
  if (selection.series.options.handing && selection.series.options.handing.length > 0 && !selection.handing) return false;

  // Pin count is required if the selected keyway has multiple pin options
  if (selection.keyway?.availablePins && selection.keyway.availablePins.length > 1 && !selection.pins) return false;

  return true;
}

/**
 * Get the count of total selectable fields and the count of selected fields.
 * Handing not counted if the series has no handing options.
 * Style/Grade not counted if they don't exist.
 */
export function getFieldCounts(series: ProductSeries | null, selection: Selection): { total: number; selected: number } {
  if (!series) return { total: 0, selected: 0 };

  const requiredFields: Array<(s: Selection) => boolean> = [
    (s) => s.function !== null,
    (s) => s.finish !== null,
    (s) => s.keyway !== null,
    (s) => s.backset !== null,
  ];

  // Handing is optional
  if (series.options.handing && series.options.handing.length > 0) {
    requiredFields.push((s) => s.handing !== null);
  }

  // Style if it exists
  if (series.options.style && series.options.style.length > 0) {
    requiredFields.push((s) => s.style !== null);
  }

  // Grade if it exists
  if (series.options.grade && series.options.grade.length > 0) {
    requiredFields.push((s) => s.grade !== null);
  }

  // Pin count is required if the selected keyway has multiple pin options
  // We check the selection's keyway, not the series options, since availablePins is per-keyway
  if (selection.keyway?.availablePins && selection.keyway.availablePins.length > 1) {
    requiredFields.push((s) => s.pins !== null);
  }

  const total = requiredFields.length;
  const selected = requiredFields.filter((f) => f(selection)).length;

  return { total, selected };
}