import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DEFAULT_CITY, getBasketPageData } from "../../lib/lab-data";
import { BasketGroups, SeoHeader, formatRub } from "../../lib/seo-ui";
import { getBasketBySlug, getSiteUrl } from "../../lib/seo";
import type { BasketOptimizationResult } from "@labmind/lab-crawlers/src/product-layer";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const basket = getBasketBySlug(slug);
  if (!basket) return {};

  const canonical = `${getSiteUrl()}/basket/${basket.slug}`;
  return {
    title: `${basket.title}: где дешевле сдать в Москве | LabPrice OS`,
    description: basket.description,
    alternates: { canonical },
  };
}

export default async function BasketSeoPage({ params }: PageProps) {
  const { slug } = await params;
  const basket = getBasketBySlug(slug);
  if (!basket) notFound();

  const data = await getBasketPageData({
    tests: basket.tests.join(","),
    city: DEFAULT_CITY,
    mode: "optimization",
  }) as BasketOptimizationResult;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <SeoHeader />
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Link href="/search" className="text-sm text-slate-500">Поиск анализов</Link>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          {basket.title}: где дешевле сдать в Москве
        </h1>
        <p className="mt-4 max-w-3xl text-slate-600">{basket.description}</p>

        <section className="mt-6 grid gap-3 md:grid-cols-4">
          <Metric label="Рекомендация" value={formatStrategy(data.recommendation.strategy)} />
          <Metric label="Итог" value={formatRub(data.recommendation.total_rub)} />
          <Metric label="Экономия" value={formatRub(data.recommendation.savings_rub)} />
          <Metric label="Лабораторий" value={String(recommendedProviderCount(data))} />
        </section>

        <section className="mt-6 border border-slate-200 bg-white p-5">
          <div className="text-xs uppercase text-slate-500">Почему такой маршрут</div>
          <div className="mt-2 text-sm text-slate-800">{data.recommendation.why}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {basket.tests.map((test) => (
              <Link key={test} className="border border-slate-300 px-3 py-2 text-sm" href={`/compare?test=${encodeURIComponent(test)}&city=${encodeURIComponent(DEFAULT_CITY)}`}>
                {test}
              </Link>
            ))}
          </div>
        </section>

        <BasketGroups data={data} city={DEFAULT_CITY} campaign={`basket_${basket.slug}`} />
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function recommendedProviderCount(data: BasketOptimizationResult): number {
  if (data.recommendation.strategy === "single_provider") return data.single_provider_option.provider_count;
  if (data.recommendation.strategy === "split_provider") return data.split_provider_option.provider_count;
  return 0;
}

function formatStrategy(value: string): string {
  if (value === "single_provider") return "Одна лаборатория";
  if (value === "split_provider") return "Разделить маршрут";
  return "Нет полного маршрута";
}
