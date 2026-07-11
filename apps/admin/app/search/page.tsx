import Link from "next/link";
import type {
  DbLabSearchResult,
  DbLabSearchSuggestion,
  DbPriceComparisonOffer,
} from "@labmind/lab-crawlers/src/supabase-lab-catalog.repository";
import { SearchBox } from "../components/SearchBox";
import { buildCheckoutHref } from "../lib/checkout";
import { DEFAULT_CITY, getLabDataSource, getLabSearchPageData } from "../lib/lab-data";

type PageProps = {
  searchParams: Promise<{ q?: string; city?: string; lat?: string; lng?: string }>;
};

const quickTests = ["Кариотип", "Ферритин", "Глюкоза", "ТТГ", "Витамин D", "Биохимия крови"];
const quickBaskets = [
  "Глюкоза,ТТГ,Ферритин",
  "Ферритин,Витамин D,ТТГ",
  "Глюкоза,Креатинин,Холестерин общий",
];

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.q || "";
  const city = params.city || DEFAULT_CITY;
  const lat = params.lat || "";
  const lng = params.lng || "";
  const hasQuery = query.trim().length > 0;
  const isBasket = query.includes(",");
  const targetHref = buildResultHref({ query, city, lat, lng, type: isBasket ? "basket" : "test" });
  const dataSource = getLabDataSource();
  const searchData = hasQuery && !isBasket
    ? await getLabSearchPageData({ q: query, city, limit: "8" })
    : undefined;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-950 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/" className="text-sm text-slate-500">LabPrice OS</Link>
            <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Где дешевле и ближе сдать анализы
            </h1>
            <p className="mt-3 max-w-2xl text-base text-slate-600 sm:text-sm">
              Найдите один анализ или соберите корзину. Гео нужно только для подсказки ближайшей точки.
            </p>
            {dataSource === "local_demo" ? (
              <div className="mt-3 inline-flex border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                Demo mode: данные из local fixtures, Supabase не нужен.
              </div>
            ) : null}
          </div>
          <Link href="/dashboard" className="hidden border border-slate-300 px-3 py-2 text-sm sm:inline-flex">Dashboard</Link>
        </div>

        <SearchBox initialQuery={query} initialCity={city} initialLat={lat} initialLng={lng} />

        {hasQuery && isBasket ? (
          <section className="mt-6 border border-slate-200 bg-white p-5">
            <div className="text-xs uppercase text-slate-500">Следующий шаг</div>
            <div className="mt-2 text-lg font-semibold">Оптимизировать корзину</div>
            <p className="mt-2 text-sm text-slate-600">
              Система подберёт маршрут: одна лаборатория или разделение по лучшим ценам.
            </p>
            <Link
              href={targetHref}
              className="mt-4 inline-flex h-10 items-center bg-slate-950 px-4 text-sm font-medium text-white"
            >
              Открыть
            </Link>
          </section>
        ) : null}

        {searchData ? (
          <SearchResultsPreview data={searchData} city={city} lat={lat} lng={lng} query={query} />
        ) : null}

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <QuickList title="Популярные анализы" items={quickTests} city={city} lat={lat} lng={lng} type="test" />
          <QuickList title="Готовые корзины" items={quickBaskets} city={city} lat={lat} lng={lng} type="basket" />
        </section>

        <section className="mt-6 border border-blue-100 bg-blue-50 p-5">
          <div className="text-sm font-semibold text-blue-950">Есть направление от врача?</div>
          <p className="mt-2 text-sm text-blue-900">
            Загрузите фото печатного направления или вставьте текст из мессенджера — мы соберём корзину анализов.
          </p>
          <Link
            href={buildScanHref({ city, lat, lng })}
            className="mt-4 inline-flex h-10 items-center bg-blue-700 px-4 text-sm font-medium text-white"
          >
            Сканировать направление
          </Link>
        </section>
      </div>
    </main>
  );
}

function SearchResultsPreview({
  data,
  city,
  lat,
  lng,
  query,
}: {
  data: DbLabSearchResult;
  city: string;
  lat: string;
  lng: string;
  query: string;
}) {
  if (data.source_status === "not_found" || data.source_status === "suggestions_only") {
    return (
      <section className="mt-6 border border-slate-200 bg-white p-5">
        <div className="text-xs uppercase text-slate-500">Результаты поиска</div>
        <div className="mt-2 text-lg font-semibold">Точного совпадения пока нет</div>
        <p className="mt-2 text-sm text-slate-600">
          Попробуйте выбрать близкий анализ или открыть сравнение вручную.
        </p>
        <SuggestionList suggestions={data.suggestions} city={city} lat={lat} lng={lng} />
      </section>
    );
  }

  if (!data.resolved_test) {
    return null;
  }

  const compareHref = buildResultHref({ query, city, lat, lng, type: "test" });

  return (
    <section className="mt-6 border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs uppercase text-slate-500">Найден анализ</div>
          <h2 className="mt-2 text-2xl font-semibold leading-tight">{data.resolved_test.name_ru}</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="border border-slate-200 px-2 py-1">{data.resolved_test.code}</span>
            <span className="border border-slate-200 px-2 py-1">{data.city}</span>
            <span className="border border-slate-200 px-2 py-1">{data.offers.length} предлож.</span>
          </div>
        </div>
        <Link href={compareHref} className="inline-flex h-10 items-center justify-center border border-slate-300 px-4 text-sm font-medium hover:border-slate-500">
          Полное сравнение
        </Link>
      </div>

      {data.cheapest ? (
        <CheapestOfferCard offer={data.cheapest} canonicalTestId={data.resolved_test.id} city={city} />
      ) : (
        <div className="mt-5 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Анализ распознан, но в базе пока нет актуальных цен для выбранного города.
        </div>
      )}

      {data.offers.length > 0 ? (
        <div className="mt-5 hidden overflow-hidden border border-slate-200 md:block">
          <div className="grid grid-cols-[1.2fr_0.8fr_0.7fr_0.9fr] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium uppercase text-slate-500">
            <div>Лаборатория</div>
            <div>Код</div>
            <div>Цена</div>
            <div>Источник</div>
          </div>
          <div className="divide-y divide-slate-200">
            {data.offers.map((offer) => (
              <OfferRow key={`${offer.provider.code}-${offer.provider_test_id}-${offer.offer_source}`} offer={offer} city={city} canonicalTestId={data.resolved_test!.id} />
            ))}
          </div>
        </div>
      ) : null}

      {data.offers.length > 0 ? (
        <div className="mt-5 grid gap-3 md:hidden">
          {data.offers.map((offer) => (
            <MobileOfferCard key={`${offer.provider.code}-${offer.provider_test_id}-${offer.offer_source}`} offer={offer} city={city} canonicalTestId={data.resolved_test!.id} />
          ))}
        </div>
      ) : null}

      <SuggestionList suggestions={data.suggestions.filter((suggestion) => suggestion.canonical_test.id !== data.resolved_test?.id)} city={city} lat={lat} lng={lng} />
    </section>
  );
}

function CheapestOfferCard({
  offer,
  canonicalTestId,
  city,
}: {
  offer: DbPriceComparisonOffer;
  canonicalTestId: string;
  city: string;
}) {
  const href = buildCheckoutHref({
    providerCode: offer.provider.code,
    testName: offer.provider_test_name,
    canonicalTestId,
    providerTestId: offer.provider_test_id,
    targetUrl: offer.source_url,
    sourceUrl: offer.source_url,
    city,
    utmSource: "labprice_search",
    utmCampaign: "search_results",
  });

  return (
    <div className="mt-5 grid gap-4 border border-emerald-200 bg-emerald-50 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
      <div>
        <div className="text-xs font-medium uppercase text-emerald-800">Лучшая цена</div>
        <div className="mt-2 text-xl font-semibold text-slate-950">{offer.provider.name}</div>
        <div className="mt-1 text-sm text-slate-700">{offer.provider_test_name}</div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-700">
          {offer.provider_test_code ? <span className="border border-emerald-200 bg-white px-2 py-1">код {offer.provider_test_code}</span> : null}
          {offer.fetched_at ? <span className="border border-emerald-200 bg-white px-2 py-1">обновлено {formatDate(offer.fetched_at)}</span> : null}
          {offer.promotion_title ? <span className="border border-emerald-200 bg-white px-2 py-1">{offer.promotion_title}</span> : null}
        </div>
      </div>
      <div className="flex flex-col items-start gap-3 lg:items-end">
        <div className="text-3xl font-semibold tabular-nums">{formatRub(offer.total_price_rub ?? offer.effective_price_rub)}</div>
        <Link href={href} className="inline-flex h-11 w-full items-center justify-center bg-slate-950 px-5 text-sm font-medium text-white sm:w-auto">
          Перейти в лабораторию
        </Link>
      </div>
    </div>
  );
}

function OfferRow({
  offer,
  city,
  canonicalTestId,
}: {
  offer: DbPriceComparisonOffer;
  city: string;
  canonicalTestId: string;
}) {
  const href = buildCheckoutHref({
    providerCode: offer.provider.code,
    testName: offer.provider_test_name,
    canonicalTestId,
    providerTestId: offer.provider_test_id,
    targetUrl: offer.source_url,
    sourceUrl: offer.source_url,
    city,
    utmSource: "labprice_search",
    utmCampaign: "search_offer",
  });

  return (
    <div className="grid grid-cols-[1.2fr_0.8fr_0.7fr_0.9fr] gap-3 px-3 py-3 text-sm">
      <div>
        <div className="font-medium">{offer.provider.name}</div>
        <div className="mt-1 line-clamp-2 text-xs text-slate-500">{offer.provider_test_name}</div>
      </div>
      <div className="text-slate-700">{offer.provider_test_code ?? "—"}</div>
      <div className="font-semibold tabular-nums">{formatRub(offer.total_price_rub ?? offer.effective_price_rub)}</div>
      <div className="flex flex-col gap-1 text-xs">
        <Link href={href} className="font-medium text-blue-700 hover:text-blue-900">Открыть</Link>
        <span className="text-slate-500">{formatDate(offer.fetched_at)}</span>
      </div>
    </div>
  );
}

function MobileOfferCard({
  offer,
  city,
  canonicalTestId,
}: {
  offer: DbPriceComparisonOffer;
  city: string;
  canonicalTestId: string;
}) {
  const href = buildCheckoutHref({
    providerCode: offer.provider.code,
    testName: offer.provider_test_name,
    canonicalTestId,
    providerTestId: offer.provider_test_id,
    targetUrl: offer.source_url,
    sourceUrl: offer.source_url,
    city,
    utmSource: "labprice_search",
    utmCampaign: "search_offer_mobile",
  });

  return (
    <div className="border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">{offer.provider.name}</div>
          <div className="mt-1 text-xs text-slate-500">{offer.provider_test_name}</div>
        </div>
        <div className="shrink-0 text-right text-lg font-semibold tabular-nums">{formatRub(offer.total_price_rub ?? offer.effective_price_rub)}</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="border border-slate-200 px-2 py-1">код {offer.provider_test_code ?? "—"}</span>
        <span className="border border-slate-200 px-2 py-1">{formatDate(offer.fetched_at)}</span>
      </div>
      <Link href={href} className="mt-3 inline-flex h-10 w-full items-center justify-center border border-blue-700 px-4 text-sm font-medium text-blue-700">
        Открыть источник
      </Link>
    </div>
  );
}

function SuggestionList({
  suggestions,
  city,
  lat,
  lng,
}: {
  suggestions: DbLabSearchSuggestion[];
  city: string;
  lat: string;
  lng: string;
}) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <div className="text-xs uppercase text-slate-500">Похожие анализы</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <Link
            key={suggestion.canonical_test.id}
            href={`/search?${buildSearchParams({ query: suggestion.canonical_test.name_ru, city, lat, lng })}`}
            className="border border-slate-200 px-3 py-2 text-sm hover:border-slate-400"
          >
            {suggestion.canonical_test.name_ru}
          </Link>
        ))}
      </div>
    </div>
  );
}

function QuickList({
  title,
  items,
  city,
  lat,
  lng,
  type,
}: {
  title: string;
  items: string[];
  city: string;
  lat: string;
  lng: string;
  type: "test" | "basket";
}) {
  return (
    <section className="border border-slate-200 bg-white p-5">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-4 grid gap-2">
        {items.map((item) => {
          const href = buildResultHref({ query: item, city, lat, lng, type });
          return (
            <Link key={item} href={href} className="border border-slate-200 px-3 py-3 text-sm hover:border-slate-400">
              {item}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function buildResultHref(input: {
  query: string;
  city: string;
  lat: string;
  lng: string;
  type: "test" | "basket";
}): string {
  const params = new URLSearchParams();
  params.set(input.type === "test" ? "test" : "tests", input.query);
  params.set("city", input.city);
  if (input.lat && input.lng) {
    params.set("lat", input.lat);
    params.set("lng", input.lng);
  }

  return `${input.type === "test" ? "/compare" : "/basket"}?${params.toString()}`;
}

function buildSearchParams(input: {
  query: string;
  city: string;
  lat: string;
  lng: string;
}): string {
  const params = new URLSearchParams();
  params.set("q", input.query);
  params.set("city", input.city);
  if (input.lat && input.lng) {
    params.set("lat", input.lat);
    params.set("lng", input.lng);
  }
  return params.toString();
}

function buildScanHref(input: { city: string; lat: string; lng: string }): string {
  const params = new URLSearchParams();
  params.set("city", input.city);
  if (input.lat && input.lng) {
    params.set("lat", input.lat);
    params.set("lng", input.lng);
  }
  return `/scan?${params.toString()}`;
}

function formatRub(value?: number): string {
  if (value === undefined) {
    return "—";
  }

  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

function formatDate(value?: string): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
