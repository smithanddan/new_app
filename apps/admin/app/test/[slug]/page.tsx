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

  const canonical = `${getSiteUrl()}/test/${getCanonicalSlug(test)}`;
  return {
    title: `${test.name_ru}: где дешевле сдать в Москве | LabPrice OS`,
    description: `Сравнение цен на анализ ${test.name_ru} в Москве: минимальная цена, диапазон рынка и лаборатории.`,
    alternates: { canonical },
    openGraph: {
      title: `${test.name_ru}: цена и сравнение лабораторий`,
      description: `Найдите, где дешевле сдать ${test.name_ru} в Москве.`,
      url: canonical,
      type: "website",
    },
  };
}

export default async function TestSeoPage({ params }: PageProps) {
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
        <Link href="/search" className="text-sm text-slate-500">Поиск анализов</Link>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          {test.name_ru}: где дешевле сдать в Москве
        </h1>
        <p className="mt-4 max-w-3xl text-slate-600">
          Сравниваем предложения лабораторий, учитываем промо и стоимость забора биоматериала. Итоговая цена считается как цена анализа плюс забор.
        </p>

        <MarketSummaryCards summary={row?.market_summary ?? null} />
        <CheapestPanel test={test.name_ru} city={DEFAULT_CITY} slug={canonicalSlug} row={row} campaign="test_page" />

        <section className="mt-6 grid gap-3 md:grid-cols-3">
          <Link className="border border-slate-200 bg-white p-4 hover:border-slate-400" href={`/compare/${canonicalSlug}`}>
            <div className="font-semibold">Сравнить все предложения</div>
            <div className="mt-1 text-sm text-slate-600">Открыть таблицу лабораторий по анализу.</div>
          </Link>
          <Link className="border border-slate-200 bg-white p-4 hover:border-slate-400" href={`/city/moscow/${canonicalSlug}-price`}>
            <div className="font-semibold">Цена в Москве</div>
            <div className="mt-1 text-sm text-slate-600">Посмотреть городскую SEO-страницу.</div>
          </Link>
          <Link className="border border-slate-200 bg-white p-4 hover:border-slate-400" href={`/basket?tests=${encodeURIComponent(test.name_ru)}&city=${encodeURIComponent(DEFAULT_CITY)}`}>
            <div className="font-semibold">Собрать корзину</div>
            <div className="mt-1 text-sm text-slate-600">Добавить анализ в маршрут сдачи.</div>
          </Link>
        </section>

        <OffersTable row={row} test={test.name_ru} city={DEFAULT_CITY} campaign="test_page" />
      </div>
    </main>
  );
}
