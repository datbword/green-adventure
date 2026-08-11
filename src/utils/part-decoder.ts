/**
 * Reverse part number decoder — takes a raw part number string and
 * breaks it down into its components with human-readable descriptions.
 * Handles inputs without dashes, spaces, or any delimiters — the user
 * can paste a raw part number and it will still decode.
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

export interface Suggestion {
  manufacturerId: string;
  manufacturerName: string;
  partNumber: string;
  series: string;
  seriesName: string;
  matchStart: number;
  matchEnd: number;
}

/**
 * Split a pattern like "{prefix}QL{model}-{finish}-{strike}" into segments.
 * Returns an array of { type: "literal"|"placeholder", value, key? }
 */
interface PatternSegment {
  type: "literal" | "placeholder";
  value: string;
  key?: string; // for placeholders
}

function parsePattern(pattern: string): PatternSegment[] {
  const segments: PatternSegment[] = [];
  const re = /\{(\w+)\}|([^{}]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pattern)) !== null) {
    if (m[1]) {
      segments.push({ type: "placeholder", value: m[0], key: m[1] });
    } else if (m[2]) {
      segments.push({ type: "literal", value: m[2] });
    }
  }
  return segments;
}

/**
 * Normalize input: uppercase it and strip all delimiters for flexible matching.
 */
function normalizeInput(input: string): string {
  return input.trim().toUpperCase().replace(/[\s\-\/\.\_]+/g, "");
}

/**
 * Try to match input tokens sequentially against pattern segments.
 * Returns { tokens, consumed } if successful, null otherwise.
 *
 * Handles raw inputs like "DQL01SR26D306Q73" — no dashes or formatting needed.
 * Algorithm:
 *   1. Match required literal anchors in order (e.g. "QL" in Arrow patterns)
 *   2. Between anchors, match placeholder values greedily from known options
 *   3. When only delimiter literals remain, use greedyMatch for each placeholder
 *   4. Optional trailing fields may be empty (e.g. keyway and cylinderPrep)
 */
function flexMatch(
  input: string,
  segments: PatternSegment[],
  options: Record<string, SeriesOption[]>,
): { tokens: DecodedToken[]; consumed: number } | null {
  const tokens: DecodedToken[] = [];
  let pos = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    if (seg.type === "literal") {
      const litNorm = seg.value.toUpperCase().replace(/[\s\-\/\.\_]+/g, "");
      if (litNorm.length === 0) continue; // skip delimiter-only literals

      if (input.slice(pos, pos + litNorm.length) === litNorm) {
        pos += litNorm.length;
      } else {
        return null; // required literal anchor not found
      }
    } else {
      // Placeholder segment
      const key = seg.key!;
      const availableOpts = options[key] || [];

      // Find the next non-delimiter literal anchor (if any)
      let anchorLit = "";
      let anchorIdx = -1;
      for (let j = i + 1; j < segments.length; j++) {
        if (segments[j].type === "literal") {
          const norm = segments[j].value.toUpperCase().replace(/[\s\-\/\.\_]+/g, "");
          if (norm.length > 0) {
            anchorLit = norm;
            anchorIdx = j;
            break;
          }
        }
      }

      if (anchorIdx > i) {
        // There's a literal anchor ahead — consume up to it
        const endPos = input.indexOf(anchorLit, pos);
        if (endPos === -1) {
          // Anchor not found in remaining input — try greedy match instead
          const captured = greedyMatch(input.slice(pos), availableOpts);
          if (captured === null) {
            // Position is at end of input; this placeholder is empty/optional
            if (pos >= input.length) {
              tokens.push({ field: key, code: "", name: "Not specified", unknown: true });
              // Skip past delimiter segments to next placeholder
              i = anchorIdx;
              continue;
            }
            // Check if field has a blank/default option (empty string code)
            const blankOpt = availableOpts.find(o => o.code === "" || o.code === undefined);
            if (blankOpt) {
              tokens.push({ field: key, code: "", name: blankOpt.name, description: blankOpt.description });
              // Skip past delimiter segments to next placeholder
              i = anchorIdx;
              continue;
            }
            return null;
          }
          const found = lookupOption(availableOpts, captured);
          tokens.push(found
            ? { field: key, code: found.code, name: found.name, description: found.description }
            : { field: key, code: captured, name: `Unknown: ${captured}`, unknown: true }
          );
          pos += captured.replace(/[\s\-\/\.\_]+/g, "").length;
          // Skip past delimiter segments between here and the anchor
          i = anchorIdx - 1;
          continue;
        }
        const captured = input.slice(pos, endPos);
        if (captured.length === 0 && pos < input.length) {
          // Empty capture with more input — this is suspicious but possible
          // (e.g. placeholder right before anchor with no value)
          tokens.push({ field: key, code: "", name: "Not specified", unknown: true });
          pos = endPos;
        } else if (captured.length > 0) {
          const found = lookupOption(availableOpts, captured);
          tokens.push(found
            ? { field: key, code: found.code, name: found.name, description: found.description }
            : { field: key, code: captured, name: `Unknown: ${captured}`, unknown: true }
          );
          pos = endPos;
        } else {
          return null;
        }
      } else {
        // No anchor literal ahead — use greedyMatch for this placeholder
        if (pos >= input.length) {
          // End of input reached; remaining placeholders are empty/optional
          const blankOpt = availableOpts.find(o => o.code === "" || o.code === undefined);
          if (blankOpt) {
            tokens.push({ field: key, code: "", name: blankOpt.name, description: blankOpt.description });
          } else {
            tokens.push({ field: key, code: "", name: "Not specified", unknown: true });
          }
          continue;
        }
        const captured = greedyMatch(input.slice(pos), availableOpts);
        if (captured === null) {
          // Check if field has a blank/default option (empty string code)
          const blankOpt = availableOpts.find(o => o.code === "" || o.code === undefined);
          if (blankOpt) {
            tokens.push({ field: key, code: "", name: blankOpt.name, description: blankOpt.description });
            // Skip past any delimiter-only literal segments that follow
            while (i + 1 < segments.length && segments[i + 1].type === "literal" &&
                   segments[i + 1].value.replace(/[\s\-\/\.\_]+/g, "").length === 0) {
              i++;
            }
            continue;
          }
          return null;
        }
        const found = lookupOption(availableOpts, captured);
        tokens.push(found
          ? { field: key, code: found.code, name: found.name, description: found.description }
          : { field: key, code: captured, name: `Unknown: ${captured}`, unknown: true }
        );
        pos += captured.replace(/[\s\-\/\.\_]+/g, "").length;
        // Skip past any delimiter-only literal segments that follow
        while (i + 1 < segments.length && segments[i + 1].type === "literal" &&
               segments[i + 1].value.replace(/[\s\-\/\.\_]+/g, "").length === 0) {
          i++;
        }
      }
    }
  }

  if (pos < input.length) {
    return null; // didn't consume all input
  }

  return { tokens, consumed: pos };
}

/**
 * Greedy match: try to find the longest matching code from available options
 * at the start of the input string. Returns the matching code string or null.
 */
function greedyMatch(input: string, options: SeriesOption[]): string | null {
  if (options.length === 0) {
    // No options — just take up to the next expected boundary
    return input.slice(0, Math.min(6, input.length));
  }

  // Sort options by normalized code length descending (try longest match first)
  const sorted = [...options].sort((a, b) => {
    const aLen = a.code.replace(/[\s\-\/\.\_]+/g, "").length;
    const bLen = b.code.replace(/[\s\-\/\.\_]+/g, "").length;
    return bLen - aLen;
  });

  // Normalize both input and codes for comparison (strip delimiters)
  for (const opt of sorted) {
    const normCode = opt.code.toUpperCase().replace(/[\s\-\/\.\_]+/g, "");
    if (normCode.length > 0 && input.startsWith(normCode)) {
      return opt.code.toUpperCase();
    }
  }

  // Fallback: try exact match (codes may contain delimiters)
  for (const opt of sorted) {
    if (input.startsWith(opt.code.toUpperCase())) {
      return opt.code.toUpperCase();
    }
  }

  return null;
}

/**
 * Look up a code in an options array. Case-insensitive.
 */
function lookupOption(options: SeriesOption[], code: string): SeriesOption | null {
  const normalized = code.trim().toUpperCase();
  for (const opt of options) {
    if (opt.code.toUpperCase() === normalized) return opt;
  }
  return null;
}

/**
 * Attempt to decode a part number against all manufacturers and their product series.
 * Uses flexible matching that works without dashes, spaces, or formatting.
 */
export function decodePartNumber(
  rawInput: string,
  manufacturerFiles: Record<string, ManufacturerData>,
): DecodeResult | null {
  const input = normalizeInput(rawInput);
  if (!input) return null;

  let bestResult: DecodeResult | null = null;
  let bestScore = -1;

  // Try each manufacturer
  for (const [manuId, manuData] of Object.entries(manufacturerFiles)) {
    for (const product of manuData.products) {
      const pattern = product.partNumberPattern;
      if (!pattern) continue;

      const segments = parsePattern(pattern);
      const match = flexMatch(input, segments, product.options || {});

      if (match) {
        // Score: prefer more known tokens, then more total tokens, then literal prefix length
        const knownTokens = match.tokens.filter(t => !t.unknown).length;
        const totalTokens = match.tokens.length;
        const literalPrefixLen = computeLiteralPrefixLength(segments, input);
        // Weighted score: known tokens × 100 + total tokens + literal prefix bonus
        const score = knownTokens * 100 + totalTokens + literalPrefixLen;
        if (score > bestScore) {
          bestResult = {
            manufacturerId: manuId,
            manufacturerName: manuData.manufacturer,
            series: product.series,
            seriesName: product.name,
            partNumber: rawInput.trim(),
            tokens: match.tokens,
          };
          bestScore = score;
        }
      }
    }
  }

  return bestResult;
}

/**
 * Count how many chars of the input match the literal prefix of the pattern.
 * Higher = more specific match.
 */
function computeLiteralPrefixLength(segments: ReturnType<typeof parsePattern>, input: string): number {
  let matched = 0;
  let pos = 0;
  for (const seg of segments) {
    if (seg.type === "literal") {
      const litNorm = seg.value.toUpperCase().replace(/[\s\-\/\.\_]+/g, "");
      if (litNorm.length > 0 && input.slice(pos, pos + litNorm.length) === litNorm) {
        matched += litNorm.length;
        pos += litNorm.length;
      } else {
        break;
      }
    } else {
      break; // stop at first placeholder
    }
  }
  return matched;
}

/**
 * Try to find partial matches — returns all products whose pattern
 * literal text appears as a substring of the normalized input.
 */
export function tryPartialDecode(
  rawInput: string,
  manufacturerFiles: Record<string, ManufacturerData>,
): DecodeResult[] {
  const input = normalizeInput(rawInput);
  if (!input) return [];

  const results: DecodeResult[] = [];
  const seen = new Set<string>();

  for (const [manuId, manuData] of Object.entries(manufacturerFiles)) {
    for (const product of manuData.products) {
      const pattern = product.partNumberPattern;
      if (!pattern) continue;

      // Try flexible match first (best case)
      const segments = parsePattern(pattern);
      const match = flexMatch(input, segments, product.options || {});

      if (match && match.tokens.length > 0 && !seen.has(`${manuId}|${product.series}`)) {
        seen.add(`${manuId}|${product.series}`);
        results.push({
          manufacturerId: manuId,
          manufacturerName: manuData.manufacturer,
          series: product.series,
          seriesName: product.name,
          partNumber: rawInput.trim(),
          tokens: match.tokens,
        });
        continue;
      }

      // Fallback: check if the normalized literal parts of the pattern
      // appear in the input (for partial/fuzzy matching)
      const patternLitParts = pattern
        .replace(/\{[^}]+\}/g, " ")
        .toUpperCase()
        .replace(/[\s\-\/\.\_]+/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      const matchCount = patternLitParts.filter((part) => input.includes(part)).length;
      if (matchCount > 0 && patternLitParts.length > 0 && !seen.has(`${manuId}|${product.series}`)) {
        seen.add(`${manuId}|${product.series}`);
        results.push({
          manufacturerId: manuId,
          manufacturerName: manuData.manufacturer,
          series: product.series,
          seriesName: product.name,
          partNumber: rawInput.trim(),
          tokens: [], // partial — no tokens decoded
        });
      }
    }
  }

  // Sort: complete decodes (with tokens) first, then partial matches
  results.sort((a, b) => {
    if (a.tokens.length > 0 && b.tokens.length === 0) return -1;
    if (a.tokens.length === 0 && b.tokens.length > 0) return 1;
    return a.tokens.length - b.tokens.length;
  });

  return results;
}

/**
 * Generate autocomplete suggestions from all manufacturer part numbers.
 * First tries to decode the partial input against all products; products
 * whose normalized pattern literal parts match the input are suggested.
 * Also falls back to substring matching against series names and brands.
 */
export function generateSuggestions(
  input: string,
  manufacturerFiles: Record<string, ManufacturerData>,
  limit: number = 12,
): Suggestion[] {
  const results: Suggestion[] = [];
  if (!input || input.length < 1) return results;
  const normalized = normalizeInput(input);
  const lower = normalized.toLowerCase();

  for (const [manuId, manuData] of Object.entries(manufacturerFiles)) {
    for (const product of manuData.products) {
      const pattern = product.partNumberPattern || "";

      // Create a searchable string from the normalized pattern (no placeholders)
      const patternSearchText = pattern
        .replace(/\{[^}]+\}/g, "")
        .toUpperCase()
        .replace(/[\s\-\/\.\_]+/g, "");

      // Build rich search text: normalized pattern skeleton + names
      const searchText = `${patternSearchText} ${product.name} ${product.series} ${manuData.manufacturer}`.toLowerCase();
      const idx = searchText.indexOf(lower);
      if (idx >= 0) {
        results.push({
          manufacturerId: manuId,
          manufacturerName: manuData.manufacturer,
          partNumber: pattern,
          series: product.series,
          seriesName: product.name,
          matchStart: idx,
          matchEnd: idx + input.length,
        });
      }
    }
  }

  // Also try partial decode — any product that flex-matches the input
  // is a strong suggestion even if the literal parts don't substring-match
  const seenKeys = new Set(results.map((r) => `${r.manufacturerId}|${r.series}`));
  for (const [manuId, manuData] of Object.entries(manufacturerFiles)) {
    for (const product of manuData.products) {
      const key = `${manuId}|${product.series}`;
      if (seenKeys.has(key)) continue;
      const pattern = product.partNumberPattern;
      if (!pattern) continue;

      const segments = parsePattern(pattern);
      const match = flexMatch(normalized, segments, product.options || {});
      if (match && match.consumed > 0) {
        results.push({
          manufacturerId: manuId,
          manufacturerName: manuData.manufacturer,
          partNumber: pattern,
          series: product.series,
          seriesName: product.name,
          matchStart: 0,
          matchEnd: input.length,
        });
      }
    }
  }

  results.sort((a, b) => a.matchStart - b.matchStart);
  return results.slice(0, limit);
}
