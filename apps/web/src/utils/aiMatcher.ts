import { createClient } from '@supabase/supabase-js';

// Clean parsed numbers by stripping grouping separators, standardizing commas and decimals
export function parseCleanNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  
  let str = String(val).trim();
  // Whitespace elimination
  str = str.replace(/\s+/g, '');
  
  // Decimal comma resolution (e.g. 125000,00 -> 125000.00)
  // If comma is 2 characters from end, replace it with dot
  if (str.includes(',')) {
    const commaIndex = str.lastIndexOf(',');
    if (commaIndex === str.length - 3) {
      str = str.substring(0, commaIndex) + '.' + str.substring(commaIndex + 1);
    }
  }
  
  // Strip typical thousand-grouping commas
  str = str.replace(/,/g, '');
  
  // If multiple dots exist (e.g., 1.25.000.00 after comma replace), strip all except the last dot
  const dotsCount = (str.match(/\./g) || []).length;
  if (dotsCount > 1) {
    const lastDotIndex = str.lastIndexOf('.');
    str = str.replace(/\./g, (match, index) => (index === lastDotIndex ? '.' : ''));
  }
  
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

// Normalize units of measure to standard values
export function cleanUom(val: string): string {
  const normalized = val.toLowerCase().trim();
  if (['no', 'nos', 'pc', 'pcs', 'each', 'unit'].includes(normalized)) return 'Nos';
  if (['m', 'mtr', 'mtrs', 'meter', 'meters', 'rmt'].includes(normalized)) return 'Meter';
  if (['kg', 'kgs', 'kilogram', 'kilograms'].includes(normalized)) return 'Kg';
  if (['box', 'boxes', 'set', 'sets'].includes(normalized)) return 'Set';
  return 'Nos';
}

const SYNONYMS: Record<string, string> = {
  'coupler': 'coupling',
  'socket': 'coupling',
  'elbow': 'bend',
  'tee': 't-joint',
  'cplr': 'coupling'
};

function normalizeTerm(term: string): string {
  const clean = term.toLowerCase().trim();
  return SYNONYMS[clean] || clean;
}

function extractSizeTokens(name: string): string[] {
  // Digit sequences optionally followed by espec symbols (mm, inch, inches, ", etc.)
  const regex = /(\d+(?:\.\d+)?\s*(?:mm|inch|inches|mtr|meter|m|kg|\"|'|''|\/|\b))/gi;
  const matches = name.match(regex) || [];
  return matches.map(s => s.toLowerCase().replace(/\s+/g, '').trim()).filter(Boolean);
}

// Returns true if both names specify same spec units but different values (e.g. 63mm vs 50mm)
export function hasSizeMismatch(rawName: string, catalogName: string): boolean {
  const rawSizes = extractSizeTokens(rawName);
  const catalogSizes = extractSizeTokens(catalogName);
  
  if (rawSizes.length === 0 || catalogSizes.length === 0) return false;
  
  const extractNumericValue = (token: string): number | null => {
    const m = token.match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : null;
  };
  
  const getUnit = (token: string): string => {
    if (token.includes('mm')) return 'mm';
    if (token.includes('inch') || token.includes('"')) return 'inch';
    if (token.includes('kg')) return 'kg';
    if (token.includes('m') || token.includes('mtr')) return 'm';
    return '';
  };
  
  for (const r of rawSizes) {
    const rUnit = getUnit(r);
    const rVal = extractNumericValue(r);
    if (rUnit && rVal !== null) {
      for (const c of catalogSizes) {
        const cUnit = getUnit(c);
        const cVal = extractNumericValue(c);
        if (cUnit === rUnit && cVal !== null && cVal !== rVal) {
          return true; // Unit is same, but value is different
        }
      }
    }
  }
  return false;
}

function getTokens(name: string): Set<string> {
  const clean = name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
  return new Set(clean.map(normalizeTerm));
}

export function calculateJaccard(nameA: string, nameB: string): number {
  const tokensA = getTokens(nameA);
  const tokensB = getTokens(nameB);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  
  const intersection = new Set([...tokensA].filter(x => tokensB.has(x)));
  const union = new Set([...tokensA, ...tokensB]);
  return intersection.size / union.size;
}

export interface MatchCandidate {
  id: string;
  name: string;
  category: string;
  similarity: number;
}

export interface MatchResult {
  matched: boolean;
  material_id: string | null;
  similarity: number;
  candidates: MatchCandidate[];
}

export async function matchMaterial(
  supabase: any,
  organisationId: string,
  rawName: string,
  hsnCode?: string | null
): Promise<MatchResult> {
  // Step 0: Check catalog aliases memory first
  const { data: alias } = await supabase
    .from('catalog_aliases')
    .select('resolved_material_id')
    .eq('organisation_id', organisationId)
    .eq('raw_name', rawName)
    .maybeSingle();

  if (alias) {
    // Exact match learned from user corrections
    const { data: material } = await supabase
      .from('materials')
      .select('id, name, category')
      .eq('id', alias.resolved_material_id)
      .maybeSingle();

    if (material) {
      return {
        matched: true,
        material_id: material.id,
        similarity: 1.0,
        candidates: [{ id: material.id, name: material.name, category: material.category, similarity: 1.0 }]
      };
    }
  }

  // Fetch all materials in organization to compute similarity scores
  const { data: materials, error } = await supabase
    .from('materials')
    .select('id, name, category, hsn_code')
    .eq('organisation_id', organisationId);

  if (error || !materials || materials.length === 0) {
    return { matched: false, material_id: null, similarity: 0, candidates: [] };
  }

  // Step 1: Filter by exact HSN code if provided
  let filteredMaterials = materials;
  if (hsnCode) {
    const hsnMatch = materials.filter((m: any) => m.hsn_code === hsnCode);
    if (hsnMatch.length > 0) {
      filteredMaterials = hsnMatch;
    }
  }

  // Compute Jaccard similarities and filter out size mismatches
  const candidates: MatchCandidate[] = filteredMaterials.map((m: any) => {
    if (hasSizeMismatch(rawName, m.name)) {
      return { id: m.id, name: m.name, category: m.category, similarity: 0 };
    }
    const similarity = calculateJaccard(rawName, m.name);
    return { id: m.id, name: m.name, category: m.category, similarity };
  })
  .filter((c: any) => c.similarity > 0)
  .sort((a: any, b: any) => b.similarity - a.similarity);

  const topCandidate = candidates[0];
  const matched = topCandidate && topCandidate.similarity >= 0.50;

  return {
    matched: !!matched,
    material_id: matched ? topCandidate.id : null,
    similarity: topCandidate ? topCandidate.similarity : 0,
    candidates: candidates.slice(0, 5) // Return top 5 candidates for manual dropdown resolution
  };
}
