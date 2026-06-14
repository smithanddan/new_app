import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DEFAULT_CITY, getComparePageData } from "../../lib/lab-data";
import { CheapestPanel, MarketSummaryCards, OffersTable, SeoHeader } from "../../lib/seo-ui";
import { getCanonicalSlug, getSiteUrl, resolveTestSlug } from "../../lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const test = await resolveTestSlug(slug);
  if (!test) return {};

  const canonical = `${getSiteUrl()}/compare/${getCanonicalSlug(test)}`;
  return {
    title: `${test.name_ru}: сравнение цен лабораторий в Москве | LabPrice OS`,
    description: `Таблица цен на ${test.name_ru}: обычные цены, промо, забор биоматериала и итоговая стоимость.`,
    alternates: { canonical },
  };
}

export default async function CompareSeoPage({ params }: PageProps) {
  const { slug } = await params;
  const test = await resolveTestSlug(slug);
  if (!test) notFound();

  const data = await getComparePageData({ test: test.name_ru, city: DEFAULT_CITY });
  const row = data.rows[0];
  const canonicalSlug = getCanonicalSlug(test);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <SeoHeader />
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Link href={`/test/${canonicalSlug}`} className="text-sm text-slate-500">Страница анализа</Link>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          {test.name_ru}: сравнение цен в Москве
        </h1>
        <p className="mt-4 max-w-3xl text-slate-600">
          Decision table по лабораториям: сортировка по итоговой цене, промо отмечены отдельно, переходы идут через tracking checkout.
        </p>

        <MarketSummaryCards summary={row?.market_summary ?? null} />
        <CheapestPanel test={test.name_ru} city={DEFAULT_CITY} slug={canonicalSlug} row={row} campaign="compare_page" />
        <OffersTable row={row} test={test.name_ru} city={DEFAULT_CITY} campaign="compare_page" />
      </div>
    </main>
  );
}
