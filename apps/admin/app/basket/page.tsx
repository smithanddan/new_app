import Link from "next/link";
import { getBasketPageData, DEFAULT_CITY } from "../lib/lab-data";
import type {
  BasketOptimizationResult,
  BasketRouteOption,
  BasketRouteProviderGroup,
} from "@labmind/lab-crawlers/src/product-layer";

type PageProps = {
  searchParams: Promise<{ tests?: string; city?: string; mode?: string }>;
};

export default async function BasketPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tests = params.tests || "Глюкоза,ТТГ,Ферритин";
  const city = params.city || DEFAULT_CITY;
  const data = await getBasketPageData({ tests, city, mode: params.mode || "optimization" }) as BasketOptimizationResult;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm text-slate-500">Админка</Link>
            <h1 className="mt-1 text-3xl font-semibold">Корзина анализов</h1>
          </div>
          <Link href="/compare" className="border border-slate-300 px-3 py-2 text-sm">Сравнение</Link>
        </div>

        <form className="mt-6 grid gap-3 border-y border-slate-200 bg-white p-4 md:grid-cols-[1fr_180px_auto]">
          <input
            name="tests"
            defaultValue={tests}
            className="h-10 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
            placeholder="Глюкоза,ТТГ,Ферритин"
          />
          <input
            name="city"
            defaultValue={city}
            className="h-10 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
            placeholder="Город"
          />
          <button className="h-10 bg-slate-950 px-4 text-sm font-medium text-white">
            Рассчитать
          </button>
        </form>

        <section className="mt-6 grid gap-3 md:grid-cols-4">
          <Metric label="Recommendation" value={formatStrategy(data.recommendation.strategy)} />
          <Metric label="Total" value={formatRub(data.recommendation.total_rub ?? undefined)} />
          <Metric label="Savings" value={formatRub(data.recommendation.savings_rub ?? undefined)} />
          <Metric label="Providers" value={String(recommendedProviderCount(data))} />
        </section>

        <section className="mt-6 border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase text-slate-500">Why</div>
          <div className="mt-1 text-sm text-slate-800">{data.recommendation.why}</div>
          <div className="mt-2 text-xs text-slate-500">Route penalty: {data.provider_penalty_rub} RUB per extra provider</div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <RouteOption title="Option A — single provider" option={data.single_provider_option} />
          <RouteOption title="Option B — split providers" option={data.split_provider_option} />
        </section>

        <section className="mt-6 overflow-x-auto border border-slate-200 bg-white">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-3">Анализ</th>
                <th className="px-3 py-3">Provider</th>
                <th className="px-3 py-3">Позиция</th>
                <th className="px-3 py-3">Анализ цена</th>
                <th className="px-3 py-3">Забор</th>
                <th className="px-3 py-3">Line total</th>
              </tr>
            </thead>
            <tbody>
              {data.cost_matrix.map((row) => (
                <tr key={`${row.test}:${row.provider.code}:${row.offer.provider_test_id}`} className="border-t border-slate-200">
                  <td className="px-3 py-3 font-medium">{row.test}</td>
                  <td className="px-3 py-3">{row.provider.name}</td>
                  <td className="px-3 py-3">{row.offer.provider_test_name}</td>
                  <td className="px-3 py-3">{formatRub(row.test_price_rub)}</td>
                  <td className="px-3 py-3">{formatRub(row.biomaterial_price_rub)}</td>
                  <td className="px-3 py-3 font-semibold">{formatRub(row.line_total_rub)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function RouteOption({ title, option }: { title: string; option: BasketRouteOption }) {
  return (
    <section className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-xs text-slate-500">
          Total {formatRub(option.total_rub ?? undefined)} · {option.provider_count} providers
        </div>
      </div>
      <div className="p-4">
        {!option.available ? (
          <div className="text-sm text-slate-600">Недоступно для полного набора.</div>
        ) : (
          <div className="grid gap-4">
            {option.groups.map((group) => (
              <ProviderGroup key={group.provider.code} group={group} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ProviderGroup({ group }: { group: BasketRouteProviderGroup }) {
  return (
    <div className="border border-slate-200">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 text-sm">
        <div className="font-medium">{group.provider.name}</div>
        <div>{formatRub(group.total_rub)}</div>
      </div>
      <div className="divide-y divide-slate-200">
        {group.items.map((item) => (
          <div key={`${item.test}:${item.offer.provider_test_id}`} className="grid gap-2 px-3 py-2 text-sm md:grid-cols-[1fr_auto]">
            <div>
              <div className="font-medium">{item.test}</div>
              <div className="text-xs text-slate-500">{item.offer.provider_test_name}</div>
            </div>
            <div>{formatRub(item.test_price_rub)}</div>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
        Tests {formatRub(group.tests_total_rub)} + biomaterial {formatRub(group.biomaterial_fee_rub)}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function recommendedProviderCount(data: BasketOptimizationResult): number {
  if (data.recommendation.strategy === "split_provider") {
    return data.split_provider_option.provider_count;
  }
  if (data.recommendation.strategy === "single_provider") {
    return data.single_provider_option.provider_count;
  }
  return 0;
}

function formatStrategy(value: string): string {
  if (value === "single_provider") {
    return "single provider";
  }
  if (value === "split_provider") {
    return "split providers";
  }
  return "unavailable";
}

function formatRub(value: number | undefined): string {
  return value === undefined ? "-" : `${value} ₽`;
}
