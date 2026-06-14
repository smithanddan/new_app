import Link from "next/link";
import { buildCheckoutHref } from "./checkout";
import type {
  BasketOptimizationResult,
  BasketRouteProviderGroup,
  ProductCompareRow,
  ProductMarketSummary,
  ProductOffer,
} from "@labmind/lab-crawlers/src/product-layer";

export function SeoHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/search" className="text-lg font-semibold text-slate-950">LabPrice OS</Link>
        <nav className="flex gap-2 text-sm">
          <Link href="/pricing" className="border border-slate-300 px-3 py-2">API pricing</Link>
          <Link href="/api-docs" className="border border-slate-300 px-3 py-2">API docs</Link>
          <Link href="/basket" className="border border-slate-300 px-3 py-2">Корзина</Link>
        </nav>
      </div>
    </header>
  );
}

export function MarketSummaryCards({ summary }: { summary: ProductMarketSummary | null }) {
  if (!summary) {
    return (
      <section className="mt-6 border border-slate-200 bg-white p-5 text-sm text-slate-600">
        Пока нет связанных предложений для этого анализа. Данные появятся после матчинга provider tests.
      </section>
    );
  }

  return (
    <section className="mt-6 grid gap-3 md:grid-cols-4">
      <Metric label="Минимум" value={formatRub(summary.min_price_rub)} />
      <Metric label="Медиана" value={formatRub(summary.median_price_rub)} />
      <Metric label="Диапазон" value={`${formatRub(summary.min_price_rub)} - ${formatRub(summary.max_price_rub)}`} />
      <Metric label="Предложений" value={String(summary.offers_count)} />
    </section>
  );
}

export function CheapestPanel({
  test,
  city,
  slug,
  row,
  campaign,
}: {
  test: string;
  city: string;
  slug: string;
  row: ProductCompareRow | undefined;
  campaign: string;
}) {
  const cheapest = row?.cheapest;

  return (
    <section className="mt-6 border border-slate-200 bg-white p-5">
      <div className="text-xs uppercase text-slate-500">Самый дешёвый вариант</div>
      {cheapest ? (
        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="text-2xl font-semibold">
              {cheapest.provider.name} · {formatRub(cheapest.total_price_rub)}
            </div>
            <div className="mt-2 text-sm text-slate-600">{cheapest.provider_test_name}</div>
            <div className="mt-1 text-sm text-slate-600">
              Анализ {formatRub(cheapest.effective_price_rub)} + забор {formatRub(cheapest.biomaterial_price_rub)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {cheapest.source_url ? (
              <a className="bg-slate-950 px-4 py-3 text-sm font-medium text-white" href={checkoutHref(cheapest, test, city, campaign, row)}>
                Перейти в лабораторию
              </a>
            ) : null}
            <Link className="border border-slate-300 px-4 py-3 text-sm font-medium" href={`/basket?tests=${encodeURIComponent(test)}&city=${encodeURIComponent(city)}`}>
              Добавить в корзину
            </Link>
            <Link className="border border-slate-300 px-4 py-3 text-sm font-medium" href={`/compare/${slug}`}>
              Все предложения
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-sm text-slate-600">Нет предложений для сравнения.</div>
      )}
    </section>
  );
}

export function OffersTable({
  row,
  test,
  city,
  campaign,
}: {
  row: ProductCompareRow | undefined;
  test: string;
  city: string;
  campaign: string;
}) {
  const offers = row?.offers ?? [];
  return (
    <section className="mt-6 overflow-x-auto border border-slate-200 bg-white">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-3 py-3">Лаборатория</th>
            <th className="px-3 py-3">Позиция</th>
            <th className="px-3 py-3">Анализ</th>
            <th className="px-3 py-3">Забор</th>
            <th className="px-3 py-3">Итого</th>
            <th className="px-3 py-3">Тип</th>
            <th className="px-3 py-3">Действие</th>
          </tr>
        </thead>
        <tbody>
          {offers.map((offer) => (
            <tr key={`${offer.provider.code}:${offer.provider_test_id}:${offer.offer_source}:${offer.source_url}`} className="border-t border-slate-200">
              <td className="px-3 py-3 font-medium">
                {offer.provider.name}
                {offer.is_cheapest ? <span className="ml-2 text-xs text-blue-700">best</span> : null}
              </td>
              <td className="px-3 py-3">{offer.provider_test_name}</td>
              <td className="px-3 py-3">{formatRub(offer.effective_price_rub)}</td>
              <td className="px-3 py-3">{formatRub(offer.biomaterial_price_rub)}</td>
              <td className="px-3 py-3 font-semibold">{formatRub(offer.total_price_rub)}</td>
              <td className="px-3 py-3">{offer.offer_type === "promo" ? "promo" : "regular"}</td>
              <td className="px-3 py-3">
                {offer.source_url ? (
                  <a className="inline-flex h-8 items-center border border-blue-700 px-3 text-xs font-medium text-blue-700 hover:bg-blue-50" href={checkoutHref(offer, test, city, campaign, row)}>
                    Перейти
                  </a>
                ) : "-"}
              </td>
            </tr>
          ))}
          {offers.length === 0 && (
            <tr>
              <td className="px-3 py-6 text-slate-600" colSpan={7}>Нет предложений для отображения.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

export function BasketGroups({ data, city, campaign }: { data: BasketOptimizationResult; city: string; campaign: string }) {
  const option = data.recommendation.strategy === "single_provider"
    ? data.single_provider_option
    : data.split_provider_option;

  return (
    <section className="mt-6 grid gap-4 lg:grid-cols-2">
      {option.groups.map((group) => (
        <ProviderGroup key={group.provider.code} group={group} city={city} campaign={campaign} />
      ))}
    </section>
  );
}

function ProviderGroup({ group, city, campaign }: { group: BasketRouteProviderGroup; city: string; campaign: string }) {
  return (
    <div className="border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="font-semibold">{group.provider.name}</div>
        <div>{formatRub(group.total_rub)}</div>
      </div>
      <div className="divide-y divide-slate-200">
        {group.items.map((item) => (
          <div key={`${item.test}:${item.offer.provider_test_id}`} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[1fr_auto]">
            <div>
              <div className="font-medium">{item.test}</div>
              <div className="mt-1 text-xs text-slate-500">{item.offer.provider_test_name}</div>
              {item.offer.source_url ? (
                <a className="mt-2 inline-flex h-8 items-center border border-blue-700 px-3 text-xs font-medium text-blue-700" href={checkoutHref(item.offer, item.test, city, campaign)}>
                  Перейти в лабораторию
                </a>
              ) : null}
            </div>
            <div className="font-semibold">{formatRub(item.test_price_rub)}</div>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
        Анализы {formatRub(group.tests_total_rub)} + забор {formatRub(group.biomaterial_fee_rub)}
      </div>
    </div>
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

function checkoutHref(offer: ProductOffer, test: string, city: string, campaign: string, row?: ProductCompareRow) {
  return buildCheckoutHref({
    providerCode: offer.provider.code,
    testName: test,
    canonicalTestId: row?.canonical_test?.id,
    providerTestId: offer.provider_test_id,
    targetUrl: offer.source_url,
    sourceUrl: offer.source_url,
    city,
    utmSource: "seo",
    utmCampaign: campaign,
  });
}

export function formatRub(value: number | undefined | null): string {
  return value === undefined || value === null ? "-" : `${value} ₽`;
}
