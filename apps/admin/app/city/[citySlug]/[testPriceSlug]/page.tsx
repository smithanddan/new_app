import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getComparePageData } from "../../../lib/lab-data";
import { CheapestPanel, MarketSummaryCards, OffersTable, SeoHeader } from "../../../lib/seo-ui";
import { getCanonicalSlug, getCityBySlug, getSiteUrl, resolveTestFromPriceSlug, resolveTestSlug } from "../../../lib/seo";

type PageProps = {
  params: Promise<{ citySlug: string; testPriceSlug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { citySlug, testPriceSlug } = await params;
  const city = getCityBySlug(citySlug);
  const test = await resolveTestSlug(resolveTestFromPriceSlug(testPriceSlug));
  if (!city || !test) return {};

  const canonical = `${getSiteUrl()}/city/${city.slug}/${getCanonicalSlug(test)}-price`;
  return {
    title: `${test.name_ru}: цена в ${city.prepositional} | LabPrice OS`,
    description: `Минимальная цена, диапазон и сравнение лабораторий для анализа ${test.name_ru} в ${city.prepositional}.`,
    alternates: { canonical },
  };
}

export default async function CityTestPricePage({ params }: PageProps) {
  const { citySlug, testPriceSlug } = await params;
  const city = getCityBySlug(citySlug);
  const test = await resolveTestSlug(resolveTestFromPriceSlug(testPriceSlug));
  if (!city || !test) notFound();

  const data = await getComparePageData({ test: test.name_ru, city: city.name });
  const row = data.rows[0];
  const canonicalSlug = getCanonicalSlug(test);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <SeoHeader />
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Link href={`/compare/${canonicalSlug}`} className="text-sm text-slate-500">Сравнение лабораторий</Link>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          {test.name_ru}: цена в {city.prepositional}
        </h1>
        <p className="mt-4 max-w-3xl text-slate-600">
          Сводка по рынку: минимальная цена, медиана, диапазон и предложения лабораторий в городе {city.name}.
        </p>

        <MarketSummaryCards summary={row?.market_summary ?? null} />
        <CheapestPanel test={test.name_ru} city={city.name} slug={canonicalSlug} row={row} campaign="city_price_page" />
        <OffersTable row={row} test={test.name_ru} city={city.name} campaign="city_price_page" />
      </div>
    </main>
  );
}
