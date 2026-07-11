import Link from "next/link";
import { getDiscoveryQueriesPageData } from "../../lib/lab-data";

type PageProps = {
  searchParams: Promise<{
    city?: string;
    enabled?: string;
    limit?: string;
  }>;
};

export default async function DiscoveryQueriesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await getDiscoveryQueriesPageData(params);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/discovery/providers" className="text-sm text-slate-500">Discovery</Link>
            <h1 className="mt-1 text-3xl font-semibold">Discovery queries</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Seed-запросы для будущих discovery adapters. В MVP они используются manual adapter’ом и не запускают внешний crawl.
            </p>
          </div>
          <Link href="/discovery/runs" className="border border-slate-300 px-3 py-2 text-sm">Runs</Link>
        </div>

        <form className="mt-6 grid gap-3 border-y border-slate-200 bg-white p-4 md:grid-cols-[180px_160px_100px_auto]">
          <input name="city" placeholder="Город" defaultValue={data.city ?? ""} className="h-10 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900" />
          <select name="enabled" defaultValue={data.enabled === undefined ? "" : String(data.enabled)} className="h-10 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900">
            <option value="">Все</option>
            <option value="true">enabled</option>
            <option value="false">disabled</option>
          </select>
          <input name="limit" defaultValue={params.limit || "100"} className="h-10 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900" />
          <button className="h-10 bg-slate-950 px-4 text-sm font-medium text-white">Фильтр</button>
        </form>

        <section className="mt-6 overflow-x-auto border border-slate-200 bg-white">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-3">Priority</th>
                <th className="px-3 py-3">City</th>
                <th className="px-3 py-3">Query</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">Vertical</th>
                <th className="px-3 py-3">Enabled</th>
                <th className="px-3 py-3">Last run</th>
                <th className="px-3 py-3">Payload</th>
              </tr>
            </thead>
            <tbody>
              {data.queries.map((query) => (
                <tr key={query.id} className="border-t border-slate-200 align-top">
                  <td className="px-3 py-3">{query.priority}</td>
                  <td className="px-3 py-3">{query.city}</td>
                  <td className="px-3 py-3 font-medium">{query.query}</td>
                  <td className="px-3 py-3">{query.source}</td>
                  <td className="px-3 py-3">{query.vertical}</td>
                  <td className="px-3 py-3">{query.enabled ? "yes" : "no"}</td>
                  <td className="px-3 py-3">{query.last_run_at ? formatDate(query.last_run_at) : "-"}</td>
                  <td className="px-3 py-3"><code className="whitespace-pre-wrap text-xs">{JSON.stringify(query.raw_payload ?? {}, null, 2)}</code></td>
                </tr>
              ))}
              {data.queries.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-slate-600" colSpan={8}>Пока нет discovery queries</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}
