import Link from "next/link";
import { CheapestPanel, MarketSummaryCards, OffersTable, SeoHeader, formatRub as formatRubUi } from "./seo-ui";
import {
  buildSeoPath,
  formatRub,
  getDisclaimer,
  type SeoPageModel,
  type SeoServiceStats,
} from "./seo-verticals";

export function SeoVerticalPage({ model }: { model: SeoPageModel }) {
  const compareHref = model.service
    ? buildSeoPath("compare_service", model.vertical.slug, model.service.seo_slug ?? undefined)
    : "/compare";
  const cityHref = model.service
    ? buildSeoPath("city_service", model.vertical.slug, model.service.seo_slug ?? undefined, model.citySlug)
    : `/${model.citySlug ?? "moscow"}/${model.vertical.slug}`;
  const basketHref = model.service?.service_kind === "lab_test"
    ? `/basket?tests=${encodeURIComponent(model.service.name_ru)}&city=${encodeURIComponent(model.city ?? "Москва")}`
    : "/search";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <SeoHeader />
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link href="/search">Поиск</Link>
          <span>/</span>
          <Link href={`/${model.vertical.slug}`}>{model.vertical.name}</Link>
          {model.service ? (
            <>
              <span>/</span>
              <span>{model.service.name_ru}</span>
            </>
          ) : null}
        </div>

        <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight">
          {model.service
            ? `${model.service.name_ru}: цены и сравнение${model.city ? ` в ${model.city}` : ""}`
            : `${model.vertical.name}: сравнение цен и доступности`}
        </h1>
        <p className="mt-4 max-w-3xl text-slate-600">{model.description}</p>

        {model.service ? (
          <>
            <SeoStatsCards stats={model.stats} />
            <SeoCtaStrip compareHref={compareHref} cityHref={cityHref} basketHref={basketHref} isLab={model.service.service_kind === "lab_test"} />
            {model.compareRow ? (
              <>
                <MarketSummaryCards summary={model.compareRow.market_summary ?? null} />
                <CheapestPanel
                  test={model.service.name_ru}
                  city={model.city ?? "Москва"}
                  slug={model.service.seo_slug ?? model.service.code ?? model.service.id}
                  row={model.compareRow}
                  campaign={`seo_${model.vertical.slug}`}
                />
                <OffersTable row={model.compareRow} test={model.service.name_ru} city={model.city ?? "Москва"} campaign={`seo_${model.vertical.slug}`} />
              </>
            ) : (
              <NearbyProviders stats={model.stats} />
            )}
          </>
        ) : (
          <section className="mt-6 border border-slate-200 bg-white p-5">
            <div className="text-sm uppercase text-slate-500">Vertical engine</div>
            <div className="mt-2 text-2xl font-semibold">Одна витрина для всех услуг</div>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Страницы этой вертикали строятся из общего каталога услуг и единого price/availability engine. В sitemap попадают только страницы с достаточным количеством данных.
            </p>
          </section>
        )}

        <Disclaimer text={getDisclaimer(model.vertical.domain)} />
      </div>
    </main>
  );
}

export function SeoStatsCards({ stats }: { stats: SeoServiceStats | null }) {
  if (!stats) return null;
  return (
    <section className="mt-6 grid gap-3 md:grid-cols-4">
      <Metric label="Минимум" value={formatRub(stats.min_price_rub)} />
      <Metric label="Медиана" value={formatRub(stats.median_price_rub)} />
      <Metric label="Диапазон" value={`${formatRub(stats.min_price_rub)} - ${formatRub(stats.max_price_rub)}`} />
      <Metric label="Провайдеров" value={String(stats.providers_count)} />
    </section>
  );
}

function SeoCtaStrip({
  compareHref,
  cityHref,
  basketHref,
  isLab,
}: {
  compareHref: string;
  cityHref: string;
  basketHref: string;
  isLab: boolean;
}) {
  return (
    <section className="mt-6 flex flex-wrap gap-2">
      <Link className="bg-slate-950 px-4 py-3 text-sm font-medium text-white" href={compareHref}>
        Сравнить предложения
      </Link>
      <Link className="border border-slate-300 px-4 py-3 text-sm font-medium" href={cityHref}>
        Страница города
      </Link>
      <Link className="border border-slate-300 px-4 py-3 text-sm font-medium" href={basketHref}>
        {isLab ? "Добавить в корзину" : "Найти провайдера"}
      </Link>
    </section>
  );
}

function NearbyProviders({ stats }: { stats: SeoServiceStats | null }) {
  const providers = stats?.nearby_providers ?? [];
  return (
    <section className="mt-6 border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3 font-semibold">Ближайшие провайдеры</div>
      <div className="divide-y divide-slate-200">
        {providers.map((provider, index) => (
          <div key={`${provider.provider_name}:${provider.address ?? index}`} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_auto]">
            <div>
              <div className="font-medium">{provider.provider_name}</div>
              {provider.address ? <div className="mt-1 text-slate-600">{provider.address}</div> : null}
            </div>
            {provider.source_url ? (
              <a className="inline-flex h-8 items-center border border-blue-700 px-3 text-xs font-medium text-blue-700" href={provider.source_url}>
                Перейти
              </a>
            ) : null}
          </div>
        ))}
        {providers.length === 0 ? <div className="px-4 py-6 text-sm text-slate-600">Пока нет провайдеров с достаточными данными.</div> : null}
      </div>
    </section>
  );
}

function Disclaimer({ text }: { text: string }) {
  return (
    <section className="mt-6 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      {text}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value || formatRubUi(null)}</div>
    </div>
  );
}

