/**
 * Reverse part number decoder — takes a raw part number string and
 * breaks it down into its components with human-readable descriptions.
 */

import type { ManufacturerData, ProductSeries, SeriesOption } from "~/types";

export interface DecodedToken {
  field: string;
  code: string;
  name: string;
  description?: string;
  unknown?: true;
}

export interface DecodeResult {
  manufacturerId: string;
  manufacturerName: string;
  series: string;
  seriesName: string;
  partNumber: string;
  tokens: DecodedToken[];
}

/**
 * Convert a part number pattern with {placeholders} into a regex
 * that captures each placeholder value.
 */
function patternToRegex(pattern: string): RegExp {
  // Escape regex special chars except { }
  let escaped = pattern.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
  // Replace {placeholder} with a capturing group
  escaped = escaped.replace(/\{(\w+)\}/g, "([^\\s\\-\\/]+)");
  // Add optional surrounding whitespace
  return new RegExp("^\\s*" + escaped + "\\s*$", "i");
}

/**
 * For a given pattern, extract the ordered list of placeholder keys.
 */
function getPlaceholders(pattern: string): string[] {
  const re = /\{(\w+)\}/g;
  const keys: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(pattern)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

/**
 * Look up a code in an options array.
 */
function lookupOption(options: SeriesOption[], code: string): SeriesOption | null {
  const normalized = code.trim();
  // Exact match first
  for (const opt of options) {
    if (opt.code === normalized) {
      return opt;
    }
  }
  // Case-insensitive
  const lower = normalized.toLowerCase();
  for (const opt of options) {
    if (opt.code.toLowerCase() === lower) {
      return opt;
    }
  }
  return null;
}

/**
 * Strip delimiters (spaces, dashes, slashes) that might separate tokens
 * in the pattern but not be part of the actual token values.
 */
function normalizeInput(input: string): string {
  return input.trim();
}

/**
 * Attempt to decode a part number against all manufacturers and their product series.
 * Returns the best match (first successful full decode) or partial results.
 */
export function decodePartNumber(
  rawInput: string,
  manufacturerFiles: Record<string, ManufacturerData>,
): DecodeResult | null {
  const input = normalizeInput(rawInput);
  if (!input) return null;

  // Try each manufacturer
  for (const [manuId, manuData] of Object.entries(manufacturerFiles)) {
    for (const product of manuData.products) {
      const pattern = product.partNumberPattern;
      if (!pattern) continue;

      const regex = patternToRegex(pattern);
      const match = input.match(regex);

      if (match) {
        // Found a matching pattern
        const placeholders = getPlaceholders(pattern);
        const tokens: DecodedToken[] = [];

        // match[0] is the full match, match[1..n] are captures
        for (let i = 0; i < placeholders.length; i++) {
          const field = placeholders[i];
          const capturedValue = match[i + 1] || "";
          const options = product.options[field];

          if (options && options.length > 0) {
            const found = lookupOption(options, capturedValue);
            if (found) {
              tokens.push({
                field,
                code: found.code,
                name: found.name,
                description: found.description,
              });
            } else {
              tokens.push({
                field,
                code: capturedValue,
                name: `Unknown: ${capturedValue}`,
                unknown: true,
              });
            }
          } else {
            tokens.push({
              field,
              code: capturedValue,
              name: `Unknown: ${capturedValue}`,
              unknown: true,
            });
          }
        }

        return {
          manufacturerId: manuId,
          manufacturerName: manuData.manufacturer,
          series: product.series,
          seriesName: product.name,
          partNumber: input,
          tokens,
        };
      }
    }
  }

  return null;
}

/**
 * Try to find partial matches across manufacturers.
 * This handles cases where the full part number doesn't match but
 * parts of it can be identified.
 */
export function tryPartialDecode(
  rawInput: string,
  manufacturerFiles: Record<string, ManufacturerData>,
): DecodeResult[] {
  const input = normalizeInput(rawInput);
  if (!input) return [];

  // Try with different delimiter normalizations
  const variants = [input];
  // Replace spaces with dashes
  if (input.includes(" ")) {
    variants.push(input.replace(/\s+/g, "-"));
  }
  // Replace dashes with spaces
  if (input.includes("-")) {
    variants.push(input.replace(/-/g, " "));
  }

  const results: DecodeResult[] = [];
  const seen = new Set<string>();

  for (const variant of variants) {
    for (const [manuId, manuData] of Object.entries(manufacturerFiles)) {
      for (const product of manuData.products) {
        const result = decodePartNumber(variant, {
          [manuId]: manuData,
        } as Record<string, ManufacturerData>);

        if (result && !seen.has(`${manuId}|${product.series}`)) {
          seen.add(`${manuId}|${product.series}`);
          results.push(result);
        }
      }
    }
  }

  return results;
}
