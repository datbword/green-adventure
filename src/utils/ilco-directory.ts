import type { IlcoBlank, IlcoFamily, IlcoDirectoryData } from "~/types";

// ── User Tags (localStorage) ──

const TAGS_KEY = "ilco-tags";

export function getUserTags(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(TAGS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveUserTags(tags: Record<string, string[]>): void {
  localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
}

export function addTag(ilcoNumber: string, tag: string): Record<string, string[]> {
  const tags = getUserTags();
  const existing = tags[ilcoNumber] || [];
  if (!existing.includes(tag)) {
    tags[ilcoNumber] = [...existing, tag];
    saveUserTags(tags);
  }
  return tags;
}

export function removeTag(ilcoNumber: string, tag: string): Record<string, string[]> {
  const tags = getUserTags();
  if (tags[ilcoNumber]) {
    tags[ilcoNumber] = tags[ilcoNumber].filter((t) => t !== tag);
    if (tags[ilcoNumber].length === 0) delete tags[ilcoNumber];
    saveUserTags(tags);
  }
  return tags;
}

// ── Search ──

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export interface IlcoSearchResult {
  blank: IlcoBlank;
  familyName: string;
  score: number;
}

/**
 * Search ILCO directory. Searches ILCO number, family name, keyway/cross-refs,
 * original part number, Axxess number, JMA number, and user tags.
 * Results ranked: exact ILCO match > family match > tag match > other.
 */
export function searchIlcoDirectory(
  query: string,
  data: IlcoDirectoryData,
  userTags: Record<string, string[]>,
): IlcoSearchResult[] {
  if (!query.trim()) return [];

  const q = normalize(query);
  if (!q) return [];

  const results: IlcoSearchResult[] = [];

  for (const family of data.families) {
    const normFamily = normalize(family.familyName);

    for (const blank of family.blanks) {
      const normIlco = normalize(blank.ilcoNumber);
      const tags = [
        ...(blank.tags || []),
        ...(userTags[blank.ilcoNumber] || []),
      ];

      let score = 0;

      // Exact ILCO match
      if (normIlco === q) score += 50;
      // ILCO starts with
      else if (normIlco.startsWith(q)) score += 35;

      // ILCO contains
      if (normIlco.includes(q)) score += 20;

      // Family name match
      if (normFamily.includes(q)) score += 15;

      // Cross-reference matches
      const xref = blank.crossReferences;
      if (xref) {
        const xrefSources: (string | undefined)[] = [
          xref.original?.code, xref.original?.id,
          xref.axxess?.code, xref.axxess?.id,
          xref.jma?.code, xref.jma?.id,
          xref.silca?.code, xref.silca?.id,
          xref.jet?.code, xref.jet?.id,
          xref.taylor?.code, xref.taylor?.id,
          xref.curtis?.code, xref.curtis?.id,
          xref.dominion?.code, xref.dominion?.id,
          xref.esp?.code, xref.esp?.id,
        ];
        for (const xv of xrefSources) {
          if (xv && normalize(xv).includes(q)) score += 12;
        }
      }

      // Tag matches
      for (const tag of tags) {
        if (normalize(tag).includes(q)) score += 8;
      }

      if (score > 0) {
        results.push({ blank, familyName: family.familyName, score });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 60);
}

// ── Family grouping ──

export function groupByFamily(data: IlcoDirectoryData): IlcoFamily[] {
  return data.families;
}
