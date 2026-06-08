import type { NormalizedLabResult, ParsedLabItem } from '@labmind/shared';

export type NormalizeContext = {
  patientSex?: 'male' | 'female' | null;
  patientBirthdate?: string | null;
  takenAt?: string | null;
};

export async function normalizeLabItems(
  items: ParsedLabItem[],
  _context: NormalizeContext,
): Promise<NormalizedLabResult[]> {
  // TODO: Match analyte_aliases, normalize units, parse ref ranges, compute flags.
  return items.map((item) => ({
    code: 'UNKNOWN',
    name: item.nameRaw,
    value: Number(String(item.valueRaw).replace(',', '.')),
    unit: item.unitRaw ?? '',
    flag: 'unknown',
    confidence: 0.2,
  }));
}
