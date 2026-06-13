import Link from "next/link";
import { Fragment } from "react";
import { getComparePageData, DEFAULT_CITY } from "../lib/lab-data";

type PageProps = {
  searchParams: Promise<{ test?: string; city?: string }>;
};

export default async function ComparePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const test = params.test || "Глюкоза";
  const city = params.city || DEFAULT_CITY;
  const data = await getComparePageData({ test, city });
  const row = data.rows[0];
  const offers = row?.offers ?? [];
  const providerGroups = row?.provider_groups ?? [];
  const marketSummary = row?.market_summary ?? null;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <Header title="Сравнение цен" />

        <form className="mt-6 grid gap-3 border-y border-slate-200 bg-white p-4 md:grid-cols-[1fr_180px_auto]">
          <input
            name="test"
            defaultValue={test}
            className="h-10 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
            placeholder="Анализ"
          />
          <input
            name="city"
            defaultValue={city}
            className="h-10 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
            placeholder="Город"
          />
          <button className="h-10 bg-slate-950 px-4 text-sm font-medium text-white">
            Найти
          </button>
        </form>

        {marketSummary && (
          <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <div className="border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase text-slate-500">Market summary</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <Metric label="Min" value={formatRub(marketSummary.min_price_rub)} />
                <Metric label="Max" value={formatRub(marketSummary.max_price_rub)} />
                <Metric label="Avg" value={formatRub(marketSummary.avg_price_rub)} />
                <Metric label="Median" value={formatRub(marketSummary.median_price_rub)} />
                <Metric label="Offers" value={String(marketSummary.offers_count)} />
                <Metric label="Promo ratio" value={`${marketSummary.promo_ratio}%`} />
              </div>
              <div className="mt-4 border-t border-slate-200 pt-3 text-sm">
                <div className="text-slate-500">Cheapest</div>
                <div className="mt-1 font-medium">
                  {marketSummary.cheapest.provider.name}: {marketSummary.cheapest.provider_test_name}
                </div>
                <div className="mt-1 text-slate-700">{formatRub(marketSummary.cheapest.total_price_rub)}</div>
              </div>
              <div className="mt-4 border-t border-slate-200 pt-3 text-sm">
                <div className="text-slate-500">Spread</div>
                <div className="mt-1 font-medium">
                  {formatRub(marketSummary.price_spread_rub)} · {marketSummary.price_spread_percent ?? 0}%
                </div>
                <div className="mt-1 text-slate-700">
                  Promo effect: {marketSummary.promo_effect_rub === null ? "-" : formatRub(marketSummary.promo_effect_rub)}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 bg-white">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-3">Provider</th>
                    <th className="px-3 py-3">Offers</th>
                    <th className="px-3 py-3">Min</th>
                    <th className="px-3 py-3">Max</th>
                    <th className="px-3 py-3">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {marketSummary.provider_distribution.map((provider) => (
                    <tr key={provider.provider.code} className="border-t border-slate-200">
                      <td className="px-3 py-3 font-medium">{provider.provider.name}</td>
                      <td className="px-3 py-3">{provider.offers_count}</td>
                      <td className="px-3 py-3">{formatRub(provider.min_price_rub)}</td>
                      <td className="px-3 py-3">{formatRub(provider.max_price_rub)}</td>
                      <td className="px-3 py-3">{formatRub(provider.avg_price_rub)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="mt-6 overflow-x-auto border border-slate-200 bg-white">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-3">Best</th>
                <th className="px-3 py-3">Лаборатория</th>
                <th className="px-3 py-3">Позиция</th>
                <th className="px-3 py-3">Код</th>
                <th className="px-3 py-3">Анализ</th>
                <th className="px-3 py-3">Забор</th>
                <th className="px-3 py-3">Итог</th>
                <th className="px-3 py-3">Тип</th>
                <th className="px-3 py-3">Источник</th>
                <th className="px-3 py-3">Ссылка</th>
              </tr>
            </thead>
            <tbody>
              {providerGroups.map((group) => (
                <Fragment key={group.provider.code}>
                  <tr className="border-t border-slate-300 bg-slate-50">
                    <td className="px-3 py-2 text-xs font-semibold uppercase text-slate-500" colSpan={10}>
                      {group.provider.name} · {group.offers.length} offers · cheapest {formatRub(group.cheapest.total_price_rub)}
                    </td>
                  </tr>
                  {group.offers.map((offer) => (
                    <tr key={`${offer.provider.code}:${offer.provider_test_id}:${offer.offer_source}:${offer.source_url}`} className="border-t border-slate-200">
                      <td className="px-3 py-3 font-medium">{offer.is_cheapest ? "cheapest" : ""}</td>
                      <td className="px-3 py-3 font-medium">{offer.provider.name}</td>
                      <td className="px-3 py-3">{offer.provider_test_name}</td>
                      <td className="px-3 py-3 text-slate-600">{offer.provider_test_code || "-"}</td>
                      <td className="px-3 py-3">{formatRub(offer.effective_price_rub)}</td>
                      <td className="px-3 py-3">{formatRub(offer.biomaterial_price_rub)}</td>
                      <td className="px-3 py-3 font-semibold">{formatRub(offer.total_price_rub)}</td>
                      <td className="px-3 py-3">{formatOfferType(offer.offer_type)}</td>
                      <td className="px-3 py-3">{offer.offer_source}</td>
                      <td className="px-3 py-3">
                        {offer.source_url ? <a className="text-blue-700 underline" href={offer.source_url}>url</a> : "-"}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {offers.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-slate-600" colSpan={10}>
                    {row?.error === "canonical_test_not_found" ? "Анализ не найден в canonical_tests" : "Нет предложений"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function Header({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Link href="/" className="text-sm text-slate-500">Админка</Link>
        <h1 className="mt-1 text-3xl font-semibold">{title}</h1>
      </div>
      <nav className="flex gap-2 text-sm">
        <Link href="/basket" className="border border-slate-300 px-3 py-2">Корзина</Link>
        <Link href="/match" className="border border-slate-300 px-3 py-2">Матчинг</Link>
        <Link href="/runs" className="border border-slate-300 px-3 py-2">Запуски</Link>
      </nav>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function formatRub(value: number | undefined): string {
  return value === undefined ? "-" : `${value} ₽`;
}

function formatOfferType(value: string): string {
  return value === "promo" ? "promo" : "regular";
}
