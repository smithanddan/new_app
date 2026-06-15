import Link from "next/link";
import { GeoLocationFields } from "../components/GeoLocationFields";
import { SaveBasketButton } from "../components/SaveBasketButton";
import { buildCheckoutHref } from "../lib/checkout";
import { getBasketPageData, DEFAULT_CITY } from "../lib/lab-data";
import type {
  BasketOptimizationResult,
  BasketRouteOption,
  BasketRouteProviderGroup,
  BasketRouteItem,
} from "@labmind/lab-crawlers/src/product-layer";

type PageProps = {
  searchParams: Promise<{ tests?: string; city?: string; mode?: string; lat?: string; lng?: string; sort?: string }>;
};

export default async function BasketPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tests = params.tests || "Глюкоза,ТТГ,Ферритин";
  const city = params.city || DEFAULT_CITY;
  const lat = params.lat || "";
  const lng = params.lng || "";
  const sort = params.sort || "price";
  const hasGeo = Boolean(lat && lng);
  const data = await getBasketPageData({ tests, city, mode: params.mode || "optimization", lat, lng, sort }) as BasketOptimizationResult;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-950 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/search" className="text-sm text-slate-500">Поиск</Link>
            <h1 className="mt-1 text-3xl font-semibold leading-tight">Корзина анализов</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/compare" className="border border-slate-300 px-3 py-2 text-sm">Сравнение</Link>
            <Link href="/dashboard" className="border border-slate-300 px-3 py-2 text-sm">Dashboard</Link>
          </div>
        </div>

        <form className="mt-6 grid gap-3 border-y border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_160px_140px_auto]">
          <input
            name="tests"
            defaultValue={tests}
            className="h-12 border border-slate-300 px-3 text-base outline-none focus:border-slate-900 md:h-10 md:text-sm"
            placeholder="Глюкоза,ТТГ,Ферритин"
          />
          <input
            name="city"
            defaultValue={city}
            className="h-12 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 md:h-10"
            placeholder="Город"
          />
          <select
            name="sort"
            defaultValue={sort}
            className="h-12 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 md:h-10"
          >
            <option value="price">Дешевле</option>
            <option value="distance">Ближе</option>
          </select>
          <button className="h-12 bg-slate-950 px-4 text-sm font-medium text-white md:h-10">
            Рассчитать
          </button>
          <div className="md:col-span-4">
            <GeoLocationFields initialLat={lat} initialLng={lng} updateUrl />
          </div>
        </form>
        {hasGeo ? (
          <div className="mt-3 border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950">
            Geo v1: для каждого выбранного провайдера показывается ближайшая mock/manual точка. Реальное время в пути и карты появятся позже.
          </div>
        ) : null}

        <section className="mt-6 grid gap-3 md:grid-cols-4">
          <Metric label="Лучший маршрут" value={formatStrategy(data.recommendation.strategy)} />
          <Metric label="Итоговая цена" value={formatRub(data.recommendation.total_rub ?? undefined)} />
          <Metric label="Экономия" value={formatRub(data.recommendation.savings_rub ?? undefined)} />
          <Metric label="Лабораторий" value={String(recommendedProviderCount(data))} />
        </section>

        <section className="mt-6 border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs uppercase text-slate-500">Почему это выгодно</div>
              <div className="mt-1 text-sm text-slate-800">{data.recommendation.why}</div>
              <div className="mt-2 text-xs text-slate-500">Route penalty: {data.provider_penalty_rub} RUB per extra provider</div>
            </div>
            <SaveBasketButton tests={tests} city={city} lat={lat} lng={lng} />
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <RouteOption title="Option A — single provider" option={data.single_provider_option} city={city} />
          <RouteOption title="Option B — split providers" option={data.split_provider_option} city={city} />
        </section>

        <section className="mt-6 grid gap-3 lg:hidden">
          {data.cost_matrix.map((row) => (
            <BasketLineCard key={`${row.test}:${row.provider.code}:${row.offer.provider_test_id}`} item={{
              test: row.test,
              canonical_test: row.canonical_test,
              offer: row.offer,
              test_price_rub: row.test_price_rub,
              biomaterial_price_rub: row.biomaterial_price_rub,
            }} city={city} />
          ))}
        </section>

        <section className="mt-6 hidden overflow-x-auto border border-slate-200 bg-white lg:block">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-3">Анализ</th>
                <th className="px-3 py-3">Provider</th>
                <th className="px-3 py-3">Позиция</th>
                <th className="px-3 py-3">Анализ цена</th>
                <th className="px-3 py-3">Забор</th>
                <th className="px-3 py-3">Line total</th>
                <th className="px-3 py-3">Ближайшая точка</th>
                <th className="px-3 py-3">Км</th>
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
                  <td className="px-3 py-3">{row.offer.nearest_location ? `${row.offer.nearest_location.name}, ${row.offer.nearest_location.address}` : "-"}</td>
                  <td className="px-3 py-3">{formatDistance(row.offer.distance_km)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function RouteOption({ title, option, city }: { title: string; option: BasketRouteOption; city: string }) {
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
              <ProviderGroup key={group.provider.code} group={group} city={city} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ProviderGroup({ group, city }: { group: BasketRouteProviderGroup; city: string }) {
  return (
    <div className="border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 text-sm">
        <div>
          <div className="font-medium">{group.provider.name}</div>
          {group.nearest_location ? (
            <div className="mt-1 text-xs text-slate-500">
              Ближайшая точка: {group.nearest_location.address} · {formatDistance(group.distance_km)}
            </div>
          ) : null}
        </div>
        <div>{formatRub(group.total_rub)}</div>
      </div>
      <div className="divide-y divide-slate-200">
        {group.items.map((item) => (
          <BasketLineCard key={`${item.test}:${item.offer.provider_test_id}`} item={item} city={city} compact />
        ))}
      </div>
      <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
        Tests {formatRub(group.tests_total_rub)} + biomaterial {formatRub(group.biomaterial_fee_rub)}
      </div>
    </div>
  );
}

function BasketLineCard({ item, city, compact = false }: { item: BasketRouteItem; city: string; compact?: boolean }) {
  return (
    <div className={compact ? "grid gap-2 px-3 py-2 text-sm md:grid-cols-[1fr_auto]" : "border border-slate-200 bg-white p-4 text-sm shadow-sm"}>
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-medium">{item.test}</div>
            <div className="mt-1 text-xs text-slate-500">{item.offer.provider.name}: {item.offer.provider_test_name}</div>
          </div>
          <div className="text-right font-semibold">{formatRub(item.test_price_rub + item.biomaterial_price_rub)}</div>
        </div>
        {item.offer.nearest_location ? (
          <div className="mt-2 text-xs text-slate-500">
            Ближайшая точка: {item.offer.nearest_location.address} · {formatDistance(item.offer.distance_km)}
          </div>
        ) : null}
        {item.offer.source_url ? (
          <a
            className="mt-3 inline-flex h-9 items-center border border-blue-700 px-3 text-xs font-medium text-blue-700 hover:bg-blue-50"
            href={buildCheckoutHref({
              providerCode: item.offer.provider.code,
              testName: item.test,
              canonicalTestId: item.canonical_test?.id,
              providerTestId: item.offer.provider_test_id,
              targetUrl: item.offer.source_url,
              sourceUrl: item.offer.source_url,
              city,
              utmSource: "labprice",
              utmCampaign: "basket_mobile",
            })}
          >
            Перейти в лабораторию
          </a>
        ) : null}
      </div>
      {compact ? <div>{formatRub(item.test_price_rub)}</div> : null}
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

function formatDistance(value: number | undefined): string {
  return value === undefined ? "-" : `${value} км`;
}
