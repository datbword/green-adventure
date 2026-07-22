import type { Selection, ProductSeries, SeriesOption, ManufacturerData } from "~/types";

/**
 * ANSI/BHMA finish code bridge map.
 * Maps manufacturer finish codes or ANSI codes to standard names for cross-brand matching.
 */
const FINISH_STANDARDS: Record<string, string> = {
  // ANSI/BHMA codes
  "605": "Bright Brass",
  "606": "Satin Brass",
  "611": "Bright Bronze",
  "612": "Satin Bronze",
  "613": "Oil Rubbed Bronze",
  "618": "Bright Nickel",
  "619": "Satin Nickel",
  "625": "Bright Chrome",
  "626": "Satin Chrome",
  "627": "Satin Aluminum",
  "628": "Clear Anodized Aluminum",
  "629": "Bright Stainless",
  "630": "Satin Stainless",
  "689": "Dark Bronze Painted",
  // Manufacturing shorthand codes
  "26D": "Satin Chrome",
  "26": "Bright Chrome",
  "32D": "Satin Stainless",
  "32": "Bright Stainless",
  "3": "Bright Brass",
  "4": "Satin Brass",
  "10": "Satin Bronze",
  "10B": "Oil Rubbed Bronze",
  "15": "Satin Nickel",
  "313": "Dark Bronze Anodized",
  "335": "Black",
};

/** Known finish name aliases */
const FINISH_ALIASES: Record<string, string[]> = {
  "Bright Brass": ["bright brass", "us3", "polished brass"],
  "Satin Brass": ["satin brass", "us4", "brushed brass"],
  "Satin Bronze": ["satin bronze", "us10", "bronze"],
  "Oil Rubbed Bronze": ["oil rubbed bronze", "us10b", "dark bronze", "orb"],
  "Satin Nickel": ["satin nickel", "us15", "brushed nickel"],
  "Bright Chrome": ["bright chrome", "us26", "polished chrome"],
  "Satin Chrome": ["satin chrome", "us26d", "brushed chrome"],
  "Satin Stainless": ["satin stainless", "us32d", "stainless steel", "satin stainless steel"],
  "Bright Stainless": ["bright stainless", "us32"],
  "Clear Anodized Aluminum": ["clear anodized aluminum", "us28", "aluminum", "satin aluminum", "clear aluminum"],
  "Dark Bronze Anodized": ["dark bronze anodized", "dark anodized aluminum"],
  "Black": ["black", "black anodized", "black painted"],
  "Dark Bronze Painted": ["dark bronze painted"],
};

/**
 * Extract ANSI standard name from a finish option's code, name, or description.
 */
function getFinishStandard(opt: SeriesOption): string | null {
  // Try direct code match
  const codeMatch = FINISH_STANDARDS[opt.code];
  if (codeMatch) return codeMatch;

  // Try to find ANSI code in description
  const desc = (opt.description ?? "").toLowerCase();
  const ansiMatch = desc.match(/us(\d+[a-z]?)/i);
  if (ansiMatch) {
    const ansiCode = ansiMatch[1].toUpperCase();
    const mapped = FINISH_STANDARDS[ansiCode];
    if (mapped) return mapped;
  }

  // Try name alias matching
  const name = opt.name.toLowerCase();
  for (const [standard, aliases] of Object.entries(FINISH_ALIASES)) {
    if (aliases.some((a) => name.includes(a) || desc.includes(a))) {
      return standard;
    }
  }

  return null;
}

/**
 * ANSI/BHMA function codes mapped to standard function names.
 */
const FUNCTION_STANDARDS: Record<string, string> = {
  "F01": "Passage",
  "F02": "Privacy",
  "F04": "Entry/Office",
  "F05": "Office",
  "F07": "Classroom",
  "F08": "Storeroom",
  "F10": "Passage/Closet",
  "F13": "Communicating",
  "F14": "Entry/Keyed",
  "F16": "Double Cylinder",
  "F19": "Double Cylinder Deadbolt",
};

const FUNCTION_ALIASES: Record<string, string[]> = {
  "Passage": ["passage", "f01", "non-locking", "closet", "hall"],
  "Privacy": ["privacy", "f02", "bed/bath", "bedroom", "bathroom"],
  "Entry/Office": ["entry", "office", "f04", "f14", "keyed", "entry/office", "entry keyed"],
  "Classroom": ["classroom", "f07", "class"],
  "Storeroom": ["storeroom", "f08", "store room", "always locked"],
  "Passage/Closet": ["passage/closet", "f10", "exit"],
  "Double Cylinder": ["double cylinder", "f16", "f19", "key both sides"],
};

function getFunctionStandard(opt: SeriesOption): string | null {
  // Try code match
  const codeMatch = FUNCTION_STANDARDS[opt.code];
  if (codeMatch) return codeMatch;

  // Try name/description
  const combined = `${opt.name} ${opt.description ?? ""}`.toLowerCase();
  for (const [standard, aliases] of Object.entries(FUNCTION_ALIASES)) {
    if (aliases.some((a) => combined.includes(a))) {
      return standard;
    }
  }

  return null;
}

/**
 * Fields that can be converted between brands (universal standards).
 */
const CONVERTIBLE_FIELDS = new Set([
  "finish",
  "function",
  "handing",
  "backset",
  "voltage",
  "size",
  "length",
]);

/**
 * Fields that are universal and use same codes across all brands — direct match.
 */
const UNIVERSAL_FIELDS = new Set([
  "handing",
  "backset",
]);

/**
 * Convert a single option to the target brand's product.
 * Returns the best matching option, or null if no match found.
 */
function convertOption(
  key: string,
  selectedOption: SeriesOption,
  targetOptions: SeriesOption[],
): SeriesOption | null {
  if (!targetOptions || targetOptions.length === 0) return null;

  // 1. Direct code match (same code exists in target)
  const directMatch = targetOptions.find((o) => o.code === selectedOption.code);
  if (directMatch) return directMatch;

  // 2. Universal fields — try exact name match then first option
  if (UNIVERSAL_FIELDS.has(key)) {
    const nameMatch = targetOptions.find(
      (o) => o.name.toLowerCase() === selectedOption.name.toLowerCase()
    );
    if (nameMatch) return nameMatch;
    // For universal fields with simple codes, try numeric/code prefix match
    const codeMatch = targetOptions.find(
      (o) =>
        o.code.replace(/[^0-9\/]/g, "") === selectedOption.code.replace(/[^0-9\/]/g, "")
    );
    if (codeMatch) return codeMatch;
    return null;
  }

  // 3. Finish conversion via ANSI bridge
  if (key === "finish") {
    const selectedStandard = getFinishStandard(selectedOption);
    if (selectedStandard) {
      const standardMatch = targetOptions.find((o) => getFinishStandard(o) === selectedStandard);
      if (standardMatch) return standardMatch;
    }
    // Fallback: name contains the same key words
    const nameWords = selectedOption.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    if (nameWords.length > 0) {
      const nameMatch = targetOptions.find((o) =>
        nameWords.every((w) => o.name.toLowerCase().includes(w))
      );
      if (nameMatch) return nameMatch;
    }
    return null;
  }

  // 4. Function conversion via ANSI bridge
  if (key === "function") {
    const selectedStandard = getFunctionStandard(selectedOption);
    if (selectedStandard) {
      const standardMatch = targetOptions.find((o) => getFunctionStandard(o) === selectedStandard);
      if (standardMatch) return standardMatch;
    }
    // Keyword fallback
    const keywords = selectedOption.name.toLowerCase().split(/[\s\/]+/).filter((w) => w.length > 2);
    if (keywords.length > 0) {
      const nameMatch = targetOptions.find((o) =>
        keywords.some(
          (kw) => o.name.toLowerCase().includes(kw) || (o.description ?? "").toLowerCase().includes(kw)
        )
      );
      if (nameMatch) return nameMatch;
    }
    return null;
  }

  // 5. Voltage/size/length — direct name match
  if (key === "voltage" || key === "size" || key === "length") {
    const nameMatch = targetOptions.find(
      (o) => o.name.toLowerCase() === selectedOption.name.toLowerCase()
    );
    if (nameMatch) return nameMatch;
    // Try code match after normalizing
    const codeNorm = selectedOption.code.replace(/[^0-9]/g, "");
    const codeMatch = targetOptions.find(
      (o) => o.code.replace(/[^0-9]/g, "") === codeNorm && codeNorm.length > 0
    );
    if (codeMatch) return codeMatch;
    return null;
  }

  return null;
}

export interface ConversionResult {
  /** Options that were successfully converted */
  converted: Record<string, { from: SeriesOption; to: SeriesOption }>;
  /** Options that couldn't be converted (keyway, styles, etc.) */
  skipped: string[];
  /** Count of total attempted conversions */
  attempted: number;
}

/**
 * Convert all current selections when switching brands.
 * Takes the current selection state and the target series, and returns
 * the best matching options for the new brand.
 */
export function convertSelections(
  currentSelection: Selection,
  targetSeries: ProductSeries,
): ConversionResult {
  const result: ConversionResult = {
    converted: {},
    skipped: [],
    attempted: 0,
  };

  if (!currentSelection.options || !targetSeries.options) {
    return result;
  }

  const targetOpts = targetSeries.options;

  for (const [key, selectedOption] of Object.entries(currentSelection.options)) {
    if (!selectedOption) continue;

    const targetFieldOptions = targetOpts[key];
    if (!targetFieldOptions || targetFieldOptions.length === 0) {
      // Target series doesn't have this option type
      continue;
    }

    if (!CONVERTIBLE_FIELDS.has(key)) {
      // Skip non-convertible fields (keyway, style, trim, etc.)
      result.skipped.push(key);
      continue;
    }

    result.attempted++;
    const match = convertOption(key, selectedOption, targetFieldOptions);
    if (match) {
      result.converted[key] = { from: selectedOption, to: match };
    } else {
      result.skipped.push(key);
    }
  }

  return result;
}
