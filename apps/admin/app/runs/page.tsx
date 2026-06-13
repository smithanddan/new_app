import Link from "next/link";
import { getRunsPageData } from "../lib/lab-data";

type PageProps = {
  searchParams: Promise<{ limit?: string }>;
};

export default async function RunsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const limit = params.limit || "50";
  const runs = await getRunsPageData({ limit });

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm text-slate-500">Админка</Link>
            <h1 className="mt-1 text-3xl font-semibold">История парсинга</h1>
          </div>
          <Link href="/compare" className="border border-slate-300 px-3 py-2 text-sm">Сравнение</Link>
        </div>

        <form className="mt-6 flex gap-3 border-y border-slate-200 bg-white p-4">
          <input name="limit" defaultValue={limit} className="h-10 w-28 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900" />
          <button className="h-10 bg-slate-950 px-4 text-sm font-medium text-white">Обновить</button>
        </form>

        <section className="mt-6 overflow-x-auto border border-slate-200 bg-white">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-3">Started</th>
                <th className="px-3 py-3">Provider</th>
                <th className="px-3 py-3">Region</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Stats</th>
                <th className="px-3 py-3">Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-t border-slate-200 align-top">
                  <td className="px-3 py-3">{formatDate(run.started_at)}</td>
                  <td className="px-3 py-3 font-medium">{run.provider?.display_name || run.provider?.name || run.provider?.code || "-"}</td>
                  <td className="px-3 py-3">{run.region?.name || run.region?.code || "-"}</td>
                  <td className="px-3 py-3">{run.run_type}</td>
                  <td className="px-3 py-3">{run.status}</td>
                  <td className="px-3 py-3">
                    <code className="whitespace-pre-wrap text-xs">{JSON.stringify(run.stats, null, 2)}</code>
                  </td>
                  <td className="px-3 py-3 text-red-700">{run.error || "-"}</td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-slate-600" colSpan={7}>Нет запусков</td>
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
