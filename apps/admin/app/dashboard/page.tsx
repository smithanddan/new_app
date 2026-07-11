import Link from "next/link";
import type { ReactNode } from "react";
import { DEFAULT_CITY, getDashboardPageData } from "../lib/lab-data";

type PageProps = {
  searchParams: Promise<{ city?: string }>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const city = params.city || DEFAULT_CITY;
  const { report, runs } = await getDashboardPageData({ city });
  const stats = report.stats;
  const matchStatusRows = Object.entries(stats.match_status_counts)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm text-slate-500">Админка</Link>
            <h1 className="mt-1 text-3xl font-semibold">Market dashboard</h1>
          </div>
          <nav className="flex gap-2 text-sm">
            <Link href="/compare" className="border border-slate-300 px-3 py-2">Сравнение</Link>
            <Link href="/basket" className="border border-slate-300 px-3 py-2">Корзина</Link>
            <Link href="/seo-demand" className="border border-slate-300 px-3 py-2">SEO demand</Link>
            <Link href="/match" className="border border-slate-300 px-3 py-2">Матчинг</Link>
          </nav>
        </div>

        <form className="mt-6 flex gap-3 border-y border-slate-200 bg-white p-4">
          <input
            name="city"
            defaultValue={city}
            className="h-10 w-52 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
            placeholder="Город"
          />
          <button className="h-10 bg-slate-950 px-4 text-sm font-medium text-white">Обновить</button>
        </form>

        <section className="mt-6 grid gap-3 md:grid-cols-4">
          <Metric label="Providers" value={stats.providers_count} />
          <Metric label="Canonical tests" value={stats.canonical_tests_count} />
          <Metric label="Provider tests" value={stats.provider_tests_count} />
          <Metric label="Prices" value={stats.provider_test_prices_count} />
          <Metric label="Matched" value={stats.provider_tests_matched_count} />
          <Metric label="Unmatched" value={stats.provider_tests_unmatched_count} />
          <Metric label="Promotions" value={stats.promotions_count} />
          <Metric label="Runs" value={stats.scraper_runs_count} />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Panel title="Canonical coverage">
            <div className="grid gap-3 md:grid-cols-3">
              <Metric label="Tracked" value={report.canonical_coverage.tests_count} compact />
              <Metric label="With offers" value={report.canonical_coverage.with_offers_count} compact />
              <Metric label="No offers" value={report.canonical_coverage.without_offers_count} compact />
            </div>
            <Table
              headers={["Анализ", "Offers", "Providers", "Cheapest", "Status"]}
              rows={report.canonical_coverage.rows.map((row) => [
                row.test,
                String(row.offers_count),
                String(row.provider_groups.length),
                row.cheapest ? `${row.cheapest.provider.name} ${formatRub(row.cheapest.total_price_rub)}` : "-",
                row.offers_count > 0 ? "ready" : row.error ?? "needs match/data",
              ])}
            />
          </Panel>

          <Panel title="Provider coverage">
            <Table
              headers={["Provider", "Tests", "Offers", "Cheapest wins"]}
              rows={report.provider_coverage.map((provider) => [
                provider.provider.name,
                String(provider.tests_count),
                String(provider.offers_count),
                String(provider.cheapest_count),
              ])}
              empty="Нет provider coverage"
            />
          </Panel>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Panel title="Top price spreads">
            <Table
              headers={["Анализ", "Cheapest", "Most expensive", "Delta", "%"]}
              rows={report.price_spreads.slice(0, 10).map((spread) => [
                spread.test,
                `${spread.cheapest.provider.name} ${formatRub(spread.cheapest.total_price_rub)}`,
                `${spread.most_expensive.provider.name} ${formatRub(spread.most_expensive.total_price_rub)}`,
                formatRub(spread.spread_rub),
                spread.spread_percent === null ? "-" : `${spread.spread_percent}%`,
              ])}
              empty="Пока нет анализов с ценами от двух лабораторий"
            />
          </Panel>

          <Panel title="Promo opportunities">
            <Table
              headers={["Анализ", "Provider", "Position", "Total"]}
              rows={report.promo_rows.slice(0, 10).map((item) => [
                item.test,
                item.offer.provider.name,
                item.offer.provider_test_name,
                formatRub(item.offer.total_price_rub),
              ])}
              empty="Промо по эталонным анализам не найдено"
            />
          </Panel>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <Panel title="Match states">
            <Table
              headers={["Status", "Count"]}
              rows={matchStatusRows.map(([status, count]) => [status, String(count)])}
              empty="Нет match states"
            />
          </Panel>

          <Panel title="Latest scraper runs">
            <Table
              headers={["Started", "Provider", "Region", "Status", "Stats"]}
              rows={runs.map((run) => [
                formatDate(run.started_at),
                run.provider?.display_name || run.provider?.name || run.provider?.code || "-",
                run.region?.name || run.region?.code || "-",
                run.status,
                compactStats(run.stats),
              ])}
              empty="Нет запусков"
            />
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">{title}</div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Metric({ label, value, compact = false }: { label: string; value: number | string; compact?: boolean }) {
  return (
    <div className={compact ? "border border-slate-200 p-3" : "border border-slate-200 bg-white p-4"}>
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className={compact ? "mt-1 text-xl font-semibold" : "mt-1 text-2xl font-semibold"}>{value}</div>
    </div>
  );
}

function Table({ headers, rows, empty = "Нет данных" }: { headers: string[]; rows: string[][]; empty?: string }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase text-slate-600">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-3">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}:${index}`} className="border-t border-slate-200 align-top">
              {row.map((cell, cellIndex) => (
                <td key={`${headers[cellIndex]}:${cell}`} className="px-3 py-3">{cell}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="px-3 py-6 text-slate-600" colSpan={headers.length}>{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function formatRub(value: number | undefined): string {
  return value === undefined ? "-" : `${value} ₽`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function compactStats(stats: Record<string, unknown>): string {
  const keys = ["catalogParsed", "pricesInserted", "promotionsUpserted", "errorsCount"];
  return keys
    .filter((key) => stats[key] !== undefined)
    .map((key) => `${key}: ${String(stats[key])}`)
    .join(", ") || "-";
}
