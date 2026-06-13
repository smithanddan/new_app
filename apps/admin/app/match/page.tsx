import Link from "next/link";
import { getMatchPageData, DEFAULT_CITY } from "../lib/lab-data";

type PageProps = {
  searchParams: Promise<{ provider?: string; city?: string; limit?: string }>;
};

export default async function MatchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const provider = params.provider || "dnkom";
  const city = params.city || DEFAULT_CITY;
  const limit = params.limit || "100";
  const data = await getMatchPageData({ provider, city, limit });

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm text-slate-500">Админка</Link>
            <h1 className="mt-1 text-3xl font-semibold">Матчинг анализов</h1>
          </div>
          <Link href="/compare" className="border border-slate-300 px-3 py-2 text-sm">Сравнение</Link>
        </div>

        <form className="mt-6 grid gap-3 border-y border-slate-200 bg-white p-4 md:grid-cols-[160px_180px_120px_auto]">
          <select name="provider" defaultValue={provider} className="h-10 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900">
            <option value="dnkom">dnkom</option>
            <option value="gemotest">gemotest</option>
            <option value="invitro">invitro</option>
          </select>
          <input name="city" defaultValue={city} className="h-10 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900" />
          <input name="limit" defaultValue={limit} className="h-10 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900" />
          <button className="h-10 bg-slate-950 px-4 text-sm font-medium text-white">Обновить</button>
        </form>

        <div className="mt-6 grid gap-6">
          <Summary data={[
            ["Unmatched", String(data.queue.length)],
            ["Candidates", String(data.candidates.matched_count)],
            ["Blocked", String(data.candidates.blocked_count)],
            ["Auto matched", String(data.matched.filter((item) => item.match_status === "auto_matched").length)],
            ["Manual matched", String(data.matched.filter((item) => item.match_status === "manual_matched").length)],
          ]} />

          <section className="overflow-x-auto border border-slate-200 bg-white">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-3">Статус</th>
                  <th className="px-3 py-3">Provider code</th>
                  <th className="px-3 py-3">Provider name</th>
                  <th className="px-3 py-3">Kind</th>
                  <th className="px-3 py-3">Suggestion</th>
                  <th className="px-3 py-3">CLI</th>
                </tr>
              </thead>
              <tbody>
                {data.queue.map((item) => {
                  const candidate = data.candidates.candidates.find((match) => match.provider_test_id === item.provider_test_id);
                  const blocked = data.candidates.blocked_candidates.find((match) => match.provider_test_id === item.provider_test_id);
                  const status = candidate ? "candidate" : blocked ? "blocked" : "unmatched";
                  return (
                    <tr key={item.provider_test_id} className="border-t border-slate-200 align-top">
                      <td className="px-3 py-3 font-medium">{status}</td>
                      <td className="px-3 py-3">{item.provider_test_code || "-"}</td>
                      <td className="px-3 py-3">{item.provider_test_name}</td>
                      <td className="px-3 py-3">{candidate?.provider_test_kind ?? blocked?.provider_test_kind ?? "-"}</td>
                      <td className="px-3 py-3">
                        {candidate ? `${candidate.canonical_test.name_ru} (${candidate.reason})` : blocked ? `${blocked.canonical_test.name_ru} (${blocked.reason})` : "-"}
                      </td>
                      <td className="px-3 py-3">
                        {blocked ? (
                          <span className="text-xs text-slate-500">review manually</span>
                        ) : item.provider_test_code && candidate ? (
                          <code className="break-all text-xs text-slate-700">
                            pnpm --filter @labmind/lab-crawlers match:manual -- --provider {provider} --provider-test-code "{item.provider_test_code}" --canonical "{candidate.canonical_test.name_ru}" --matched-by "local-admin" --write
                          </code>
                        ) : item.provider_test_code ? (
                          <code className="break-all text-xs text-slate-700">
                            pnpm --filter @labmind/lab-crawlers match:manual -- --provider {provider} --provider-test-code "{item.provider_test_code}" --canonical "CANONICAL_NAME" --matched-by "local-admin" --write
                          </code>
                        ) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="overflow-x-auto border border-slate-200 bg-white">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-3">Статус</th>
                  <th className="px-3 py-3">Provider code</th>
                  <th className="px-3 py-3">Provider name</th>
                  <th className="px-3 py-3">Canonical</th>
                  <th className="px-3 py-3">Confidence</th>
                  <th className="px-3 py-3">Matched at</th>
                </tr>
              </thead>
              <tbody>
                {data.matched.map((item) => (
                  <tr key={item.provider_test_id} className="border-t border-slate-200">
                    <td className="px-3 py-3 font-medium">{item.match_status}</td>
                    <td className="px-3 py-3">{item.provider_test_code || "-"}</td>
                    <td className="px-3 py-3">{item.provider_test_name}</td>
                    <td className="px-3 py-3">
                      {item.canonical_test ? `${item.canonical_test.name_ru} (${item.canonical_test.code})` : "-"}
                    </td>
                    <td className="px-3 py-3">{item.match_confidence ?? "-"}</td>
                    <td className="px-3 py-3">{item.matched_at ?? "-"}</td>
                  </tr>
                ))}
                {data.matched.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-slate-600" colSpan={6}>Нет auto/manual matched записей для текущего фильтра.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </main>
  );
}

function Summary({ data }: { data: Array<[string, string]> }) {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {data.map(([label, value]) => (
        <div key={label} className="border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
        </div>
      ))}
    </div>
  );
}
