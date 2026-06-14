import "server-only";

import type { DbCanonicalPriceComparison } from "@labmind/lab-crawlers/src/supabase-lab-catalog.repository";
import { DEFAULT_CITY, getRepository } from "./lab-data";

export type SeoCanonicalTest = DbCanonicalPriceComparison["canonical_test"] & {
  slug: string;
};

export type SeoCity = {
  slug: string;
  name: string;
  prepositional: string;
};

export type SeoBasket = {
  slug: string;
  title: string;
  description: string;
  tests: string[];
};

export const SEO_CITIES: SeoCity[] = [
  { slug: "moscow", name: DEFAULT_CITY, prepositional: "Москве" },
];

export const SEO_BASKETS: SeoBasket[] = [
  {
    slug: "anemia-panel",
    title: "Проверка железа и анемии",
    description: "Сравнить стоимость ферритина и общего анализа крови в Москве.",
    tests: ["Ферритин", "Общий анализ крови"],
  },
  {
    slug: "thyroid-checkup",
    title: "Щитовидная железа",
    description: "Найти выгодный маршрут для базовой проверки щитовидной железы.",
    tests: ["ТТГ"],
  },
  {
    slug: "metabolic-basic",
    title: "Базовый обмен веществ",
    description: "Сравнить цены на глюкозу, креатинин и общий холестерин.",
    tests: ["Глюкоза", "Креатинин", "Холестерин общий"],
  },
  {
    slug: "biochemistry",
    title: "Биохимия крови",
    description: "Собрать базовую биохимию и сравнить лаборатории по итоговой цене.",
    tests: ["Биохимия крови", "Глюкоза", "Креатинин"],
  },
];

const SPECIAL_SLUG_BY_CODE: Record<string, string> = {
  BIOCHEM: "biochemistry-blood",
  CBC: "complete-blood-count",
  CHOL: "cholesterol-total",
  CREA: "creatinine",
  FER: "ferritin",
  GLU: "glucose",
  TSH: "tsh",
  UAM: "urinalysis",
  VITD: "vitamin-d",
};

const FALLBACK_TESTS: SeoCanonicalTest[] = [
  canonicalFallback("FER", "Ферритин", "ferritin"),
  canonicalFallback("GLU", "Глюкоза", "glucose"),
  canonicalFallback("TSH", "ТТГ", "tsh"),
  canonicalFallback("VITD", "Витамин D", "vitamin-d"),
  canonicalFallback("BIOCHEM", "Биохимия крови", "biochemistry-blood"),
  canonicalFallback("CREA", "Креатинин", "creatinine"),
  canonicalFallback("CHOL", "Холестерин общий", "cholesterol-total"),
];

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function getCityBySlug(slug: string): SeoCity | undefined {
  return SEO_CITIES.find((city) => city.slug === slug);
}

export function getBasketBySlug(slug: string): SeoBasket | undefined {
  return SEO_BASKETS.find((basket) => basket.slug === slug);
}

export async function getSeoTests(): Promise<SeoCanonicalTest[]> {
  const canonicalTests = await getRepository().listCanonicalTests();
  return canonicalTests
    .map((test) => ({ ...test, slug: getCanonicalSlug(test) }))
    .sort((a, b) => a.name_ru.localeCompare(b.name_ru, "ru"));
}

export async function getSeoTestsSafe(): Promise<SeoCanonicalTest[]> {
  try {
    const tests = await getSeoTests();
    return tests.length > 0 ? tests : FALLBACK_TESTS;
  } catch {
    return FALLBACK_TESTS;
  }
}

export async function resolveTestSlug(slug: string): Promise<SeoCanonicalTest | undefined> {
  const tests = await getSeoTests();
  return tests.find((test) => getSlugCandidates(test).includes(slug));
}

export function resolveTestFromPriceSlug(value: string): string {
  return value.endsWith("-price") ? value.slice(0, -"-price".length) : value;
}

export function getCanonicalSlug(test: DbCanonicalPriceComparison["canonical_test"]): string {
  return SPECIAL_SLUG_BY_CODE[test.code] || slugify(test.name_en || test.name_ru);
}

export function slugify(value: string): string {
  return transliterate(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function getSlugCandidates(test: DbCanonicalPriceComparison["canonical_test"]): string[] {
  return [
    getCanonicalSlug(test),
    test.code.toLowerCase(),
    slugify(test.name_ru),
    ...(test.name_en ? [slugify(test.name_en)] : []),
    ...test.aliases.map(slugify),
  ].filter(Boolean);
}

function canonicalFallback(code: string, nameRu: string, slug: string): SeoCanonicalTest {
  return {
    id: code,
    code,
    name_ru: nameRu,
    name_en: null,
    aliases: [],
    slug,
  };
}

function transliterate(value: string): string {
  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };

  return [...value.toLowerCase()].map((char) => map[char] ?? char).join("");
}
