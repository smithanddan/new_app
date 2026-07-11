import Link from "next/link";
import type { ReactNode } from "react";
import { DEFAULT_CITY } from "../lib/lab-data";
import {
  getSeoDemandGapReport,
  type SeoDemandGapStatus,
} from "../lib/seo-demand-report";
import type { SeoDemandSourceSuggestion } from "../lib/seo-demand-source-suggestions";

type PageProps = {
  searchParams: Promise<{
    city?: string;
    status?: string;
  }>;
};

const STATUSES: Array<{ value: SeoDemandGapStatus | "all"; label: string }> = [
  { value: "all", label: "Все" },
  { value: "ready", label: "Ready" },
  { value: "no_prices", label: "Нет цен" },
  { value: "no_canonical", label: "Нет canonical" },
  { value: "no_landing", label: "Нет landing" },
];

export default async function SeoDemandPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const city = params.city || DEFAULT_CITY;
  const status = parseStatus(params.status);
  const report = await getSeoDemandGapReport({ city, status });

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-slate-500">Админка</Link>
            <h1 className="mt-1 text-3xl font-semibold">SEO demand</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Seed запросов, статус посадочных и gaps для следующего парсинга. Источник сейчас ручной,
              дальше сюда ляжет официальный Wordstat/Yandex Direct API.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            <Link href="/search" className="border border-slate-300 bg-white px-3 py-2">Поиск</Link>
            <Link href="/dashboard" className="border border-slate-300 bg-white px-3 py-2">Dashboard</Link>
            <Link href="/api/seo-demand/gaps" className="border border-slate-300 bg-white px-3 py-2">JSON</Link>
            <Link href="/api/seo-demand/actions" className="border border-slate-300 bg-white px-3 py-2">Actions API</Link>
            <Link href="/api/seo-demand/source-suggestions" className="border border-slate-300 bg-white px-3 py-2">Source API</Link>
            <Link href="/seo-demand/review" className="border border-slate-300 bg-white px-3 py-2">Review dry-run</Link>
          </nav>
        </div>

        <form className="mt-6 flex flex-col gap-3 border-y border-slate-200 bg-white p-4 md:flex-row md:items-end">
          <label className="grid gap-1 text-sm">
            <span className="text-xs uppercase text-slate-500">Город</span>
            <input
              name="city"
              defaultValue={city}
              className="h-10 w-full border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 md:w-56"
              placeholder="Москва"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs uppercase text-slate-500">Статус</span>
            <select
              name="status"
              defaultValue={status || "all"}
              className="h-10 w-full border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900 md:w-48"
            >
              {STATUSES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <button className="h-10 bg-slate-950 px-4 text-sm font-medium text-white">Обновить</button>
        </form>

        <section className="mt-6 grid gap-3 md:grid-cols-4">
          <Metric label="Keywords" value={report.summary.keywords} />
          <Metric label="Demand groups" value={report.summary.groups} />
          <Metric label="Ready" value={report.summary.ready} />
          <Metric label="No prices" value={report.summary.no_prices} />
          <Metric label="No canonical" value={report.summary.no_canonical} />
          <Metric label="No landing" value={report.summary.no_landing} />
          <Metric label="Avg quality" value={`${report.summary.average_quality_score}/100`} />
          <Metric label="Tests without demand" value={report.summary.tests_without_demand} />
        </section>

        <section className="mt-6 border border-slate-200 bg-white">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Gap report</h2>
              <p className="mt-1 text-xs text-slate-500">Сначала чиним no_canonical/no_prices, потом расширяем demand.</p>
            </div>
            <div className="text-xs text-slate-500">Generated: {formatDate(report.generated_at)}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Score</th>
                  <th className="px-3 py-3">Demand</th>
                  <th className="px-3 py-3">Canonical</th>
                  <th className="px-3 py-3">Landing</th>
                  <th className="px-3 py-3">Price</th>
                  <th className="px-3 py-3">Intents</th>
                  <th className="px-3 py-3">Next action</th>
                  <th className="px-3 py-3">Links</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={`${row.region}:${row.canonical_test_code}:${row.landing_slug}`} className="border-t border-slate-200 align-top">
                    <td className="px-3 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-3 py-3">
                      <QualityScore value={row.quality_score} />
                      <div className="mt-2 grid gap-1 text-xs text-slate-500">
                        {row.quality_checks.filter((check) => !check.passed).slice(0, 2).map((check) => (
                          <span key={check.key}>missing: {check.label}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{row.top_query}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.region}, {row.keyword_count} запросов, priority {row.top_priority}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.monthly_impressions === null ? "impressions: seed only" : `impressions: ${row.monthly_impressions}`}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-mono text-xs">{row.canonical_test_code}</div>
                      <div className="mt-1 max-w-[260px] text-slate-700">{row.canonical_name || "Не найден в canonical_tests"}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-mono text-xs">{row.landing_slug}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.source_status}</div>
                    </td>
                    <td className="px-3 py-3">
                      {row.cheapest_price_rub === null ? (
                        <span className="text-slate-500">Нет офферов</span>
                      ) : (
                        <>
                          <div className="font-semibold">{formatRub(row.cheapest_price_rub)}</div>
                          <div className="mt-1 text-xs text-slate-500">{row.cheapest_provider}, offers {row.offers_count}</div>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.intents.map((intent) => (
                          <span key={intent} className="border border-slate-200 px-2 py-1 text-xs">{intent}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{row.next_action.title}</div>
                      <div className="mt-1 max-w-[280px] text-xs leading-5 text-slate-600">{row.next_action.reason}</div>
                      <div className="mt-2 font-mono text-xs text-slate-500">
                        {row.next_action.action_type} · p{row.next_action.priority}
                      </div>
                      {row.source_suggestions.length > 0 ? (
                        <div className="mt-3 grid gap-2">
                          {row.source_suggestions.slice(0, 2).map((suggestion) => (
                            <SourceSuggestionCard
                              key={`${row.canonical_test_code}:${suggestion.provider}:${suggestion.strategy}`}
                              suggestion={suggestion}
                            />
                          ))}
                          <Link
                            href={`/api/seo-demand/source-suggestions?code=${encodeURIComponent(row.canonical_test_code)}&city=${encodeURIComponent(row.region)}`}
                            className="text-xs font-medium text-slate-700 underline"
                          >
                            all source suggestions
                          </Link>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <ActionLink href={row.search_href}>search</ActionLink>
                        {row.landing_href ? <ActionLink href={row.landing_href}>test</ActionLink> : null}
                        {row.compare_href ? <ActionLink href={row.compare_href}>compare</ActionLink> : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {report.rows.length === 0 && (
                  <tr>
                    <td className="px-3 py-8 text-slate-600" colSpan={9}>По этому фильтру gaps не найдены.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">Canonical tests without demand seed</div>
          <div className="grid gap-2 p-4 md:grid-cols-3">
            {report.tests_without_demand.slice(0, 30).map((test) => (
              <Link
                key={test.code}
                href={`/test/${test.slug}`}
                className="border border-slate-200 px-3 py-2 text-sm hover:border-slate-900"
              >
                <span className="font-mono text-xs text-slate-500">{test.code}</span>
                <span className="ml-2">{test.name_ru}</span>
              </Link>
            ))}
            {report.tests_without_demand.length === 0 && (
              <div className="text-sm text-slate-600">Все canonical tests покрыты seed-запросами.</div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function parseStatus(value: string | undefined): SeoDemandGapStatus | "all" | undefined {
  if (value === "ready" || value === "no_prices" || value === "no_canonical" || value === "no_landing" || value === "all") {
    return value;
  }
  return undefined;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: SeoDemandGapStatus }) {
  const className = {
    ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
    no_prices: "border-amber-200 bg-amber-50 text-amber-800",
    no_canonical: "border-rose-200 bg-rose-50 text-rose-800",
    no_landing: "border-sky-200 bg-sky-50 text-sky-800",
  }[status];

  return <span className={`inline-flex border px-2 py-1 text-xs font-medium ${className}`}>{status}</span>;
}

function QualityScore({ value }: { value: number }) {
  const className = value >= 80
    ? "bg-emerald-500"
    : value >= 60
      ? "bg-amber-500"
      : "bg-rose-500";

  return (
    <div className="w-28">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{value}</span>
        <span className="text-xs text-slate-500">/100</span>
      </div>
      <div className="mt-2 h-2 border border-slate-200 bg-slate-100">
        <div className={`h-full ${className}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function SourceSuggestionCard({ suggestion }: { suggestion: SeoDemandSourceSuggestion }) {
  return (
    <div className="border border-slate-200 bg-slate-50 p-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold uppercase">{suggestion.provider}</span>
        <span className="font-mono text-slate-500">{suggestion.region}</span>
        <span className="border border-slate-200 bg-white px-1.5 py-0.5">{suggestion.strategy}</span>
        <span className="border border-slate-200 bg-white px-1.5 py-0.5">{suggestion.status}</span>
        <span className="text-slate-500">{Math.round(suggestion.confidence * 100)}%</span>
      </div>
      <div className="mt-1 text-xs leading-5 text-slate-600">{suggestion.reason}</div>
      <code className="mt-2 block max-w-[300px] whitespace-normal break-words border border-slate-200 bg-white p-2 text-[11px] leading-5 text-slate-700">
        {suggestion.dry_run_command}
      </code>
      {suggestion.fixture_only_command ? (
        <code className="mt-1 block max-w-[300px] whitespace-normal break-words border border-slate-200 bg-white p-2 text-[11px] leading-5 text-slate-500">
          {suggestion.fixture_only_command}
        </code>
      ) : null}
    </div>
  );
}

function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="border border-slate-300 px-2 py-1 text-xs hover:border-slate-900">
      {children}
    </Link>
  );
}

function formatRub(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
