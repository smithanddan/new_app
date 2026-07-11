import type { CanonicalTestRecord, ProviderTestPriceRecord, ProviderTestRecord } from './catalog-types.js';
import { effectivePriceRub, normalizeProviderName } from './provider-scraper.js';

export type CanonicalMatchResult = {
  canonicalCode?: string;
  confidence: number;
  status: 'auto_matched' | 'unmatched';
  reason: string;
};

export type ProviderPriceComparisonRow = {
  canonicalCode: string;
  canonicalName: string;
  city: string;
  offers: Array<{
    providerCode: string;
    regionCode: string;
    externalId?: string;
    providerName: string;
    effectivePriceRub: number;
    regularPriceRub?: number;
    promoPriceRub?: number;
    biomaterialPriceRub?: number;
    totalWithBiomaterialRub?: number;
    offerType: ProviderTestPriceRecord['offerType'];
    validFrom?: string;
    validTo?: string;
    sourceUrl: string;
    fetchedAt: string;
  }>;
  cheapest?: {
    providerCode: string;
    externalId?: string;
    effectivePriceRub: number;
    totalWithBiomaterialRub?: number;
  };
};

export const DEFAULT_CANONICAL_TESTS: CanonicalTestRecord[] = [
  {
    id: 'CBC',
    code: 'CBC',
    nameRu: 'Общий анализ крови',
    nameEn: 'Complete blood count',
    kind: 'analysis',
    category: 'hematology',
    aliases: ['ОАК', 'клинический анализ крови', 'общий анализ крови'],
  },
  {
    id: 'UA',
    code: 'UA',
    nameRu: 'Общий анализ мочи',
    nameEn: 'Urinalysis',
    kind: 'analysis',
    category: 'urine',
    aliases: ['ОАМ', 'общий анализ мочи'],
  },
  {
    id: 'FER',
    code: 'FER',
    nameRu: 'Ферритин',
    nameEn: 'Ferritin',
    kind: 'analysis',
    category: 'iron',
    aliases: ['ферритин', 'ferritin'],
  },
  {
    id: 'TSH',
    code: 'TSH',
    nameRu: 'ТТГ',
    nameEn: 'Thyroid-stimulating hormone',
    kind: 'analysis',
    category: 'thyroid',
    aliases: ['ТТГ', 'TSH', 'тиреотропный гормон'],
  },
  {
    id: 'GLU',
    code: 'GLU',
    nameRu: 'Глюкоза',
    nameEn: 'Glucose',
    kind: 'analysis',
    category: 'biochemistry',
    aliases: ['глюкоза', 'glucose', 'глюкоза крови'],
  },
  {
    id: 'CHOL',
    code: 'CHOL',
    nameRu: 'Холестерин общий',
    nameEn: 'Total cholesterol',
    kind: 'analysis',
    category: 'lipids',
    aliases: ['общий холестерин', 'холестерин общий', 'total cholesterol', 'chol'],
  },
  {
    id: 'VITD',
    code: 'VITD',
    nameRu: 'Витамин D',
    nameEn: '25-OH Vitamin D',
    kind: 'analysis',
    category: 'vitamins',
    aliases: ['25-OH витамин D', 'витамин д', 'vitamin d', '25 гидроксивитамин d'],
  },
  {
    id: 'CREA',
    code: 'CREA',
    nameRu: 'Креатинин',
    nameEn: 'Creatinine',
    kind: 'analysis',
    category: 'kidney',
    aliases: ['креатинин', 'creatinine'],
  },
  {
    id: 'ALT',
    code: 'ALT',
    nameRu: 'АЛТ',
    nameEn: 'Alanine aminotransferase',
    kind: 'analysis',
    category: 'biochemistry/liver',
    aliases: ['алт', 'аланинаминотрансфераза', 'аланин аминотрансфераза', 'alt', 'alat'],
  },
  {
    id: 'AST',
    code: 'AST',
    nameRu: 'АСТ',
    nameEn: 'Aspartate aminotransferase',
    kind: 'analysis',
    category: 'biochemistry/liver',
    aliases: ['аст', 'аспартатаминотрансфераза', 'аспартат аминотрансфераза', 'ast', 'asat'],
  },
  {
    id: 'BILT',
    code: 'BILT',
    nameRu: 'Билирубин общий',
    nameEn: 'Total bilirubin',
    kind: 'analysis',
    category: 'biochemistry/liver',
    aliases: ['билирубин общий', 'общий билирубин', 'total bilirubin'],
  },
  {
    id: 'BILD',
    code: 'BILD',
    nameRu: 'Билирубин прямой',
    nameEn: 'Direct bilirubin',
    kind: 'analysis',
    category: 'biochemistry/liver',
    aliases: ['билирубин прямой', 'прямой билирубин', 'direct bilirubin'],
  },
  {
    id: 'GGT',
    code: 'GGT',
    nameRu: 'ГГТ',
    nameEn: 'Gamma-glutamyl transferase',
    kind: 'analysis',
    category: 'biochemistry/liver',
    aliases: ['ггт', 'гамма гт', 'гамма-гт', 'гамма глутамилтрансфераза', 'ggt', 'gamma gt'],
  },
  {
    id: 'ALP',
    code: 'ALP',
    nameRu: 'Щелочная фосфатаза',
    nameEn: 'Alkaline phosphatase',
    kind: 'analysis',
    category: 'biochemistry/liver',
    aliases: ['щелочная фосфатаза', 'alkaline phosphatase', 'alp', 'щф'],
  },
  {
    id: 'TP',
    code: 'TP',
    nameRu: 'Белок общий',
    nameEn: 'Total protein',
    kind: 'analysis',
    category: 'biochemistry/protein',
    aliases: ['белок общий', 'общий белок', 'total protein'],
  },
  {
    id: 'ALB',
    code: 'ALB',
    nameRu: 'Альбумин',
    nameEn: 'Albumin',
    kind: 'analysis',
    category: 'biochemistry/protein',
    aliases: ['альбумин', 'albumin'],
  },
  {
    id: 'UREA',
    code: 'UREA',
    nameRu: 'Мочевина',
    nameEn: 'Urea',
    kind: 'analysis',
    category: 'kidney',
    aliases: ['мочевина', 'urea'],
  },
  {
    id: 'UA_ACID',
    code: 'UA_ACID',
    nameRu: 'Мочевая кислота',
    nameEn: 'Uric acid',
    kind: 'analysis',
    category: 'biochemistry/kidney',
    aliases: ['мочевая кислота', 'uric acid'],
  },
  {
    id: 'CRP',
    code: 'CRP',
    nameRu: 'С-реактивный белок',
    nameEn: 'C-reactive protein',
    kind: 'analysis',
    category: 'inflammation',
    aliases: ['с реактивный белок', 'с-реактивный белок', 'срб', 'crp', 'c reactive protein'],
  },
  {
    id: 'ESR',
    code: 'ESR',
    nameRu: 'СОЭ',
    nameEn: 'Erythrocyte sedimentation rate',
    kind: 'analysis',
    category: 'hematology',
    aliases: ['соэ', 'скорость оседания эритроцитов', 'esr'],
  },
  {
    id: 'HBA1C',
    code: 'HBA1C',
    nameRu: 'Гликированный гемоглобин',
    nameEn: 'HbA1c',
    kind: 'analysis',
    category: 'diabetes',
    aliases: ['гликированный гемоглобин', 'гликозилированный гемоглобин', 'hba1c', 'hb a1c', 'гемоглобин a1c'],
  },
  {
    id: 'INS',
    code: 'INS',
    nameRu: 'Инсулин',
    nameEn: 'Insulin',
    kind: 'analysis',
    category: 'diabetes/hormones',
    aliases: ['инсулин', 'insulin'],
  },
  {
    id: 'FT4',
    code: 'FT4',
    nameRu: 'Т4 свободный',
    nameEn: 'Free thyroxine',
    kind: 'analysis',
    category: 'thyroid',
    aliases: ['т4 свободный', 'свободный т4', 'тироксин свободный', 'free t4', 'ft4'],
  },
  {
    id: 'FT3',
    code: 'FT3',
    nameRu: 'Т3 свободный',
    nameEn: 'Free triiodothyronine',
    kind: 'analysis',
    category: 'thyroid',
    aliases: ['т3 свободный', 'свободный т3', 'трийодтиронин свободный', 'free t3', 'ft3'],
  },
  {
    id: 'AT_TPO',
    code: 'AT_TPO',
    nameRu: 'Антитела к ТПО',
    nameEn: 'Anti-thyroid peroxidase antibodies',
    kind: 'analysis',
    category: 'thyroid',
    aliases: ['антитела к тпо', 'ат к тпо', 'анти тпо', 'anti tpo', 'anti-tpo', 'антитела к тиреопероксидазе'],
  },
  {
    id: 'AT_TG',
    code: 'AT_TG',
    nameRu: 'Антитела к тиреоглобулину',
    nameEn: 'Anti-thyroglobulin antibodies',
    kind: 'analysis',
    category: 'thyroid',
    aliases: ['антитела к тиреоглобулину', 'ат к тг', 'анти тг', 'anti tg', 'anti-thyroglobulin'],
  },
  {
    id: 'B12',
    code: 'B12',
    nameRu: 'Витамин B12',
    nameEn: 'Vitamin B12',
    kind: 'analysis',
    category: 'vitamins',
    aliases: ['витамин b12', 'витамин в12', 'цианокобаламин', 'vitamin b12', 'b12'],
  },
  {
    id: 'FOL',
    code: 'FOL',
    nameRu: 'Фолиевая кислота',
    nameEn: 'Folate',
    kind: 'analysis',
    category: 'vitamins',
    aliases: ['фолиевая кислота', 'фолат', 'folate', 'folic acid'],
  },
  {
    id: 'IRON',
    code: 'IRON',
    nameRu: 'Железо',
    nameEn: 'Serum iron',
    kind: 'analysis',
    category: 'iron',
    aliases: ['железо', 'сывороточное железо', 'iron', 'serum iron'],
  },
  {
    id: 'TRF',
    code: 'TRF',
    nameRu: 'Трансферрин',
    nameEn: 'Transferrin',
    kind: 'analysis',
    category: 'iron',
    aliases: ['трансферрин', 'transferrin'],
  },
  {
    id: 'MG',
    code: 'MG',
    nameRu: 'Магний',
    nameEn: 'Magnesium',
    kind: 'analysis',
    category: 'minerals',
    aliases: ['магний', 'magnesium', 'mg'],
  },
  {
    id: 'CA',
    code: 'CA',
    nameRu: 'Кальций общий',
    nameEn: 'Total calcium',
    kind: 'analysis',
    category: 'minerals',
    aliases: ['кальций общий', 'общий кальций', 'calcium total', 'total calcium'],
  },
  {
    id: 'NA',
    code: 'NA',
    nameRu: 'Натрий',
    nameEn: 'Sodium',
    kind: 'analysis',
    category: 'electrolytes',
    aliases: ['натрий', 'sodium', 'na'],
  },
  {
    id: 'K',
    code: 'K',
    nameRu: 'Калий',
    nameEn: 'Potassium',
    kind: 'analysis',
    category: 'electrolytes',
    aliases: ['калий', 'potassium', 'k'],
  },
  {
    id: 'CL',
    code: 'CL',
    nameRu: 'Хлор',
    nameEn: 'Chloride',
    kind: 'analysis',
    category: 'electrolytes',
    aliases: ['хлор', 'хлориды', 'chloride', 'chlorides', 'cl'],
  },
  {
    id: 'TG',
    code: 'TG',
    nameRu: 'Триглицериды',
    nameEn: 'Triglycerides',
    kind: 'analysis',
    category: 'lipids',
    aliases: ['триглицериды', 'triglycerides', 'tg'],
  },
  {
    id: 'HDL',
    code: 'HDL',
    nameRu: 'ЛПВП',
    nameEn: 'HDL cholesterol',
    kind: 'analysis',
    category: 'lipids',
    aliases: ['лпвп', 'холестерин лпвп', 'липопротеины высокой плотности', 'hdl', 'hdl cholesterol'],
  },
  {
    id: 'LDL',
    code: 'LDL',
    nameRu: 'ЛПНП',
    nameEn: 'LDL cholesterol',
    kind: 'analysis',
    category: 'lipids',
    aliases: ['лпнп', 'холестерин лпнп', 'липопротеины низкой плотности', 'ldl', 'ldl cholesterol'],
  },
  {
    id: 'PRL',
    code: 'PRL',
    nameRu: 'Пролактин',
    nameEn: 'Prolactin',
    kind: 'analysis',
    category: 'hormones/reproductive',
    aliases: ['пролактин', 'prolactin'],
  },
  {
    id: 'E2',
    code: 'E2',
    nameRu: 'Эстрадиол',
    nameEn: 'Estradiol',
    kind: 'analysis',
    category: 'hormones/reproductive',
    aliases: ['эстрадиол', 'estradiol', 'e2'],
  },
  {
    id: 'PROG',
    code: 'PROG',
    nameRu: 'Прогестерон',
    nameEn: 'Progesterone',
    kind: 'analysis',
    category: 'hormones/reproductive',
    aliases: ['прогестерон', 'progesterone'],
  },
  {
    id: 'TESTO',
    code: 'TESTO',
    nameRu: 'Тестостерон общий',
    nameEn: 'Total testosterone',
    kind: 'analysis',
    category: 'hormones/reproductive',
    aliases: ['тестостерон общий', 'общий тестостерон', 'total testosterone', 'testosterone'],
  },
  {
    id: 'LH',
    code: 'LH',
    nameRu: 'ЛГ',
    nameEn: 'Luteinizing hormone',
    kind: 'analysis',
    category: 'hormones/reproductive',
    aliases: ['лг', 'лютеинизирующий гормон', 'luteinizing hormone', 'lh'],
  },
  {
    id: 'FSH',
    code: 'FSH',
    nameRu: 'ФСГ',
    nameEn: 'Follicle-stimulating hormone',
    kind: 'analysis',
    category: 'hormones/reproductive',
    aliases: ['фсг', 'фолликулостимулирующий гормон', 'follicle stimulating hormone', 'fsh'],
  },
  {
    id: 'HCG',
    code: 'HCG',
    nameRu: 'ХГЧ',
    nameEn: 'Human chorionic gonadotropin',
    kind: 'analysis',
    category: 'hormones/pregnancy',
    aliases: ['хгч', 'бета хгч', 'β хгч', 'хорионический гонадотропин', 'hcg', 'beta hcg'],
  },
  {
    id: 'PSA_T',
    code: 'PSA_T',
    nameRu: 'ПСА общий',
    nameEn: 'Total PSA',
    kind: 'analysis',
    category: 'tumor_markers',
    aliases: ['пса общий', 'общий пса', 'простатический специфический антиген общий', 'psa total', 'total psa'],
  },
  {
    id: 'DDIMER',
    code: 'DDIMER',
    nameRu: 'D-димер',
    nameEn: 'D-dimer',
    kind: 'analysis',
    category: 'coagulation',
    aliases: ['d димер', 'd-димер', 'д димер', 'д-димер', 'd-dimer', 'ddimer'],
  },
  {
    id: 'COAG',
    code: 'COAG',
    nameRu: 'Коагулограмма',
    nameEn: 'Coagulation panel',
    kind: 'panel',
    category: 'coagulation',
    aliases: ['коагулограмма', 'гемостазиограмма', 'анализ свертываемости крови', 'coagulation panel'],
  },
  {
    id: 'LIPID',
    code: 'LIPID',
    nameRu: 'Липидный профиль',
    nameEn: 'Lipid profile',
    kind: 'panel',
    category: 'lipids',
    aliases: ['липидный профиль', 'липидограмма', 'lipid profile', 'липидный спектр'],
  },
  {
    id: 'THYROID_BASIC',
    code: 'THYROID_BASIC',
    nameRu: 'Щитовидная железа базовый профиль',
    nameEn: 'Basic thyroid profile',
    kind: 'panel',
    category: 'thyroid',
    aliases: ['щитовидная железа базовый профиль', 'тиреоидный профиль', 'профиль щитовидной железы', 'ттг т4 свободный', 'thyroid profile'],
  },
  {
    id: 'BIOCHEM',
    code: 'BIOCHEM',
    nameRu: 'Биохимия крови',
    nameEn: 'Blood biochemistry',
    kind: 'panel',
    category: 'biochemistry',
    aliases: ['биохимия крови', 'биохимия базовая', 'биохимический анализ крови', 'базовая биохимия', 'blood biochemistry'],
  },
  {
    id: 'KARYOTYPE',
    code: 'KARYOTYPE',
    nameRu: 'Исследование кариотипа',
    nameEn: 'Karyotype analysis',
    kind: 'analysis',
    category: 'genetics/cytogenetics',
    aliases: ['кариотип', 'кариотипирование', 'исследование кариотипа', 'цитогенетическое исследование кариотипа', 'karyotype'],
  },
];

export function matchProviderTestToCanonical(
  test: ProviderTestRecord,
  canonicalTests: CanonicalTestRecord[] = DEFAULT_CANONICAL_TESTS,
): CanonicalMatchResult {
  const providerCodeMatch = findStrongProviderCodeMatch(test, canonicalTests);
  if (providerCodeMatch) {
    return providerCodeMatch;
  }

  const normalizedName = normalizeProviderName(test.name);

  for (const canonical of canonicalTests) {
    if (normalizeProviderName(canonical.nameRu) === normalizedName) {
      return { canonicalCode: canonical.code, confidence: 1, status: 'auto_matched', reason: 'exact_name' };
    }
  }

  for (const canonical of canonicalTests) {
    const aliases = [canonical.code, canonical.nameRu, canonical.nameEn ?? '', ...canonical.aliases].filter(Boolean);
    const matchedAlias = aliases.find((alias) => {
      const normalizedAlias = normalizeProviderName(alias);
      return normalizedAlias.length > 1 && isAliasPrefixMatch(normalizedName, normalizedAlias);
    });

    if (matchedAlias) {
      if (hasComplexMarkerAfterAlias(normalizedName, normalizeProviderName(matchedAlias))) {
        return { confidence: 0, status: 'unmatched', reason: 'blocked_complex_candidate' };
      }

      return {
        canonicalCode: canonical.code,
        confidence: 0.86,
        status: 'auto_matched',
        reason: `safe_alias:${matchedAlias}`,
      };
    }
  }

  return { confidence: 0, status: 'unmatched', reason: 'no_alias_match' };
}

function findStrongProviderCodeMatch(
  test: ProviderTestRecord,
  canonicalTests: CanonicalTestRecord[],
): CanonicalMatchResult | undefined {
  if (test.providerCode === 'cmd' && test.externalCode === '190204') {
    const canonical = canonicalTests.find((item) => item.code === 'KARYOTYPE');
    if (canonical) {
      return {
        canonicalCode: canonical.code,
        confidence: 1,
        status: 'auto_matched',
        reason: 'exact_provider_code',
      };
    }
  }

  return undefined;
}

function isSafeAliasMatch(normalizedName: string, normalizedAlias: string): boolean {
  return isAliasPrefixMatch(normalizedName, normalizedAlias) && !hasComplexMarkerAfterAlias(normalizedName, normalizedAlias);
}

function isAliasPrefixMatch(normalizedName: string, normalizedAlias: string): boolean {
  if (normalizedName === normalizedAlias) {
    return true;
  }

  return normalizedName.startsWith(`${normalizedAlias} `);
}

function hasComplexMarkerAfterAlias(normalizedName: string, normalizedAlias: string): boolean {
  const rest = normalizedName === normalizedAlias
    ? ''
    : normalizedName.slice(normalizedAlias.length).trim();

  if (!rest) {
    return false;
  }

  return /^(и|плюс|моча|кал|слюна)(\s|$)/.test(rest)
    || /\+|(^|\s)(комплекс|чек ап|профиль|панель|набор|обмен|расширенное|расширенный)(\s|$)/.test(rest);
}

export function autoMatchProviderTests(
  tests: ProviderTestRecord[],
  canonicalTests: CanonicalTestRecord[] = DEFAULT_CANONICAL_TESTS,
): ProviderTestRecord[] {
  return tests.map((test) => {
    const match = matchProviderTestToCanonical(test, canonicalTests);

    if (match.status === 'unmatched') {
      return {
        ...test,
        normalizedName: normalizeProviderName(test.name),
        matchStatus: 'unmatched',
        matchConfidence: 0,
      };
    }

    return {
      ...test,
      canonicalCode: match.canonicalCode,
      normalizedName: normalizeProviderName(test.name),
      matchStatus: 'auto_matched',
      matchConfidence: match.confidence,
    };
  });
}

export function compareProviderPrices(
  tests: ProviderTestRecord[],
  prices: ProviderTestPriceRecord[],
  canonicalTests: CanonicalTestRecord[] = DEFAULT_CANONICAL_TESTS,
): ProviderPriceComparisonRow[] {
  const canonicalByCode = new Map(canonicalTests.map((test) => [test.code, test]));
  const testByProviderExternalId = new Map(
    tests
      .filter((test) => test.externalId)
      .map((test) => [`${test.providerCode}:${test.externalId}`, test]),
  );
  const groups = new Map<string, Array<{ test: ProviderTestRecord; price: ProviderTestPriceRecord; effectivePriceRub: number }>>();

  for (const price of prices) {
    const test = price.externalId ? testByProviderExternalId.get(`${price.providerCode}:${price.externalId}`) : undefined;
    const canonicalCode = test?.canonicalCode;
    const resolvedPrice = effectivePriceRub(price);

    if (!test || !canonicalCode || resolvedPrice === undefined) {
      continue;
    }

    const city = price.city ?? price.regionCode;
    const key = `${canonicalCode}:${city}`;
    groups.set(key, [...(groups.get(key) ?? []), { test, price, effectivePriceRub: resolvedPrice }]);
  }

  return [...groups.entries()]
    .map(([key, rows]) => {
      const [canonicalCode, city] = key.split(':');
      const canonical = canonicalByCode.get(canonicalCode);
      const offers = rows
        .map(({ test, price, effectivePriceRub: resolvedPrice }) => {
          const totalWithBiomaterialRub = price.biomaterialPriceRub === undefined
            ? undefined
            : resolvedPrice + price.biomaterialPriceRub;

          return {
            providerCode: price.providerCode,
            regionCode: price.regionCode,
            externalId: price.externalId,
            providerName: test.name,
            effectivePriceRub: resolvedPrice,
            regularPriceRub: price.regularPriceRub,
            promoPriceRub: price.promoPriceRub,
            biomaterialPriceRub: price.biomaterialPriceRub,
            totalWithBiomaterialRub,
            offerType: price.offerType,
            validFrom: price.validFrom,
            validTo: price.validTo,
            sourceUrl: price.sourceUrl,
            fetchedAt: price.fetchedAt,
          };
        })
        .sort((a, b) => a.effectivePriceRub - b.effectivePriceRub);

      const cheapest = offers[0]
        ? {
          providerCode: offers[0].providerCode,
          externalId: offers[0].externalId,
          effectivePriceRub: offers[0].effectivePriceRub,
          totalWithBiomaterialRub: offers[0].totalWithBiomaterialRub,
        }
        : undefined;

      return {
        canonicalCode,
        canonicalName: canonical?.nameRu ?? canonicalCode,
        city,
        offers,
        cheapest,
      };
    })
    .sort((a, b) => a.canonicalCode.localeCompare(b.canonicalCode));
}
