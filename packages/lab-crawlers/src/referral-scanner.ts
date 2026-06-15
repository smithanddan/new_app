import type { CanonicalTestRecord } from './catalog-types.js';
import { DEFAULT_CANONICAL_TESTS } from './catalog-comparison.js';
import { normalizeProviderName } from './provider-scraper.js';

export type ReferralScannerStatus = 'matched' | 'candidate' | 'unmatched' | 'ignored';

export type ReferralRawItem = {
  rawText: string;
  normalizedText: string;
  sourceLine: string;
};

export type ReferralMatch = {
  rawText: string;
  normalizedText: string;
  status: ReferralScannerStatus;
  confidence: number;
  canonical?: Pick<CanonicalTestRecord, 'id' | 'code' | 'nameRu' | 'aliases' | 'kind'>;
  reason: string;
};

export type ReferralScanResult = {
  rawText: string;
  items: ReferralRawItem[];
  matched: ReferralMatch[];
  candidates: ReferralMatch[];
  unmatched: ReferralMatch[];
  ignored: ReferralMatch[];
};

const SPLIT_MARKERS = /[\n\r;,•●▪▫·]+/g;
const NUMBERED_PREFIX = /^\s*(?:[-–—*]|\d+[.)]|[а-яa-z][.)])\s*/i;
const MIN_MEDICAL_TOKEN_LENGTH = 2;

const MEDICAL_HINTS = [
  'анализ',
  'кров',
  'моч',
  'оак',
  'оам',
  'ттг',
  'tsh',
  'ферритин',
  'ferritin',
  'глюкоз',
  'glucose',
  'витамин',
  '25 oh',
  '25-oh',
  'креатинин',
  'холестерин',
  'биохим',
  'алт',
  'аст',
  'билирубин',
  'желез',
];

const IGNORE_PATTERNS = [
  /\b(фио|пациент|пациентка|дата|возраст|пол|телефон|email|почта)\b/i,
  /\b(врач|доктор|терапевт|эндокринолог|гинеколог|клиника|поликлиника|кабинет)\b/i,
  /\b(натощак|натощаке|утром|перед сдачей|подготовка|биоматериал|кровь из вены)\b/i,
  /\b(адрес|печать|подпись|направление|назначение|рекомендовано)\b/i,
  /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/,
  /\+?\d[\d\s()—-]{7,}\d/,
];

const IGNORE_NORMALIZED_PHRASES = [
  'кровь из вены',
  'сдавать натощак',
  'натощак',
  'биоматериал',
  'направление',
  'назначение',
  'пациент',
  'пациентка',
  'дата',
  'врач',
];

const COMPLEX_MARKERS = /\+|(^|\s)(и|комплекс|чек ап|чекап|профиль|панель|набор|скрининг|расширенный|расширенное)(\s|$)/i;

export function parseReferralText(text: string): ReferralRawItem[] {
  const normalizedInput = text
    .replace(/\t/g, ' ')
    .replace(/[|]/g, '\n')
    .replace(/[ \f\v]{2,}/g, ' ');

  const seen = new Set<string>();
  const items: ReferralRawItem[] = [];

  for (const sourceLine of normalizedInput.split(SPLIT_MARKERS)) {
    const cleaned = cleanReferralLine(sourceLine);
    if (!cleaned) {
      continue;
    }

    const normalizedText = normalizeReferralText(cleaned);
    if (!normalizedText || seen.has(normalizedText)) {
      continue;
    }

    seen.add(normalizedText);
    items.push({
      rawText: cleaned,
      normalizedText,
      sourceLine: sourceLine.trim(),
    });
  }

  return items;
}

export function normalizeReferralItems(
  items: ReferralRawItem[],
  canonicalTests: CanonicalTestRecord[] = DEFAULT_CANONICAL_TESTS,
): Omit<ReferralScanResult, 'rawText' | 'items'> {
  const matched: ReferralMatch[] = [];
  const candidates: ReferralMatch[] = [];
  const unmatched: ReferralMatch[] = [];
  const ignored: ReferralMatch[] = [];

  for (const item of items) {
    const match = matchReferralItem(item, canonicalTests);
    if (match.status === 'matched') {
      matched.push(match);
    } else if (match.status === 'candidate') {
      candidates.push(match);
    } else if (match.status === 'ignored') {
      ignored.push(match);
    } else {
      unmatched.push(match);
    }
  }

  return { matched, candidates, unmatched, ignored };
}

export function scanReferralText(
  rawText: string,
  canonicalTests: CanonicalTestRecord[] = DEFAULT_CANONICAL_TESTS,
): ReferralScanResult {
  const items = parseReferralText(rawText);
  const normalized = normalizeReferralItems(items, canonicalTests);
  return {
    rawText,
    items,
    ...normalized,
  };
}

export function normalizeReferralText(value: string): string {
  return normalizeProviderName(
    value
      .replace(/[№#]/g, ' ')
      .replace(/\b25\s*[- ]?\s*oh\b/gi, '25 oh')
      .replace(/\bvit\s*d\b/gi, 'vitamin d'),
  );
}

function matchReferralItem(
  item: ReferralRawItem,
  canonicalTests: CanonicalTestRecord[],
): ReferralMatch {
  if (shouldIgnoreLine(item.rawText, item.normalizedText)) {
    return {
      rawText: item.rawText,
      normalizedText: item.normalizedText,
      status: 'ignored',
      confidence: 0,
      reason: 'ignored_non_test_line',
    };
  }

  const exact = canonicalTests.find((canonical) => {
    const values = canonicalValues(canonical);
    return values.some((value) => normalizeReferralText(value) === item.normalizedText);
  });

  if (exact) {
    return {
      rawText: item.rawText,
      normalizedText: item.normalizedText,
      status: 'matched',
      confidence: 1,
      canonical: toReferralCanonical(exact),
      reason: 'exact_name_or_alias',
    };
  }

  const aliasMatch = findAliasMatch(item.normalizedText, canonicalTests);
  if (aliasMatch) {
    const { canonical, alias } = aliasMatch;
    const isComplex = COMPLEX_MARKERS.test(item.normalizedText);
    return {
      rawText: item.rawText,
      normalizedText: item.normalizedText,
      status: isComplex ? 'candidate' : 'matched',
      confidence: isComplex ? 0.72 : 0.86,
      canonical: toReferralCanonical(canonical),
      reason: isComplex ? `candidate_complex:${alias}` : `safe_alias:${alias}`,
    };
  }

  const fuzzy = findFuzzyMatch(item.normalizedText, canonicalTests);
  if (fuzzy) {
    return {
      rawText: item.rawText,
      normalizedText: item.normalizedText,
      status: 'candidate',
      confidence: fuzzy.confidence,
      canonical: toReferralCanonical(fuzzy.canonical),
      reason: `fuzzy:${fuzzy.alias}`,
    };
  }

  return {
    rawText: item.rawText,
    normalizedText: item.normalizedText,
    status: 'unmatched',
    confidence: 0,
    reason: 'no_match',
  };
}

function cleanReferralLine(value: string): string {
  return value
    .replace(NUMBERED_PREFIX, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.:—-]+|[.:—-]+$/g, '')
    .trim();
}

function shouldIgnoreLine(rawText: string, normalizedText: string): boolean {
  if (normalizedText.length < MIN_MEDICAL_TOKEN_LENGTH) {
    return true;
  }

  if (IGNORE_PATTERNS.some((pattern) => pattern.test(rawText))) {
    return true;
  }

  if (IGNORE_NORMALIZED_PHRASES.some((phrase) => normalizedText.includes(phrase))) {
    return true;
  }

  if (/^\d+$/.test(normalizedText)) {
    return true;
  }

  return !MEDICAL_HINTS.some((hint) => normalizedText.includes(normalizeReferralText(hint)));
}

function canonicalValues(canonical: CanonicalTestRecord): string[] {
  return [
    canonical.code,
    canonical.nameRu,
    canonical.nameEn ?? '',
    ...canonical.aliases,
  ].filter(Boolean);
}

function findAliasMatch(
  normalizedText: string,
  canonicalTests: CanonicalTestRecord[],
): { canonical: CanonicalTestRecord; alias: string } | undefined {
  for (const canonical of canonicalTests) {
    for (const alias of canonicalValues(canonical)) {
      const normalizedAlias = normalizeReferralText(alias);
      if (normalizedAlias.length < MIN_MEDICAL_TOKEN_LENGTH) {
        continue;
      }

      if (normalizedText.startsWith(`${normalizedAlias} `) || normalizedText.includes(` ${normalizedAlias} `)) {
        return { canonical, alias };
      }
    }
  }

  return undefined;
}

function findFuzzyMatch(
  normalizedText: string,
  canonicalTests: CanonicalTestRecord[],
): { canonical: CanonicalTestRecord; alias: string; confidence: number } | undefined {
  let best: { canonical: CanonicalTestRecord; alias: string; confidence: number } | undefined;

  for (const canonical of canonicalTests) {
    for (const alias of canonicalValues(canonical)) {
      const normalizedAlias = normalizeReferralText(alias);
      if (normalizedAlias.length < 5) {
        continue;
      }

      const distance = levenshtein(normalizedText, normalizedAlias);
      const confidence = 1 - distance / Math.max(normalizedText.length, normalizedAlias.length);
      if (confidence >= 0.82 && (!best || confidence > best.confidence)) {
        best = { canonical, alias, confidence: Number(confidence.toFixed(2)) };
      }
    }
  }

  return best;
}

function toReferralCanonical(canonical: CanonicalTestRecord): ReferralMatch['canonical'] {
  return {
    id: canonical.id,
    code: canonical.code,
    nameRu: canonical.nameRu,
    aliases: canonical.aliases,
    kind: canonical.kind,
  };
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[a.length][b.length];
}
