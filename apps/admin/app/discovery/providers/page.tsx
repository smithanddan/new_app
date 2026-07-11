import Link from "next/link";
import { getDiscoveryProvidersPageData } from "../../lib/lab-data";

type PageProps = {
  searchParams: Promise<{
    city?: string;
    status?: string;
    source?: string;
    limit?: string;
  }>;
};

export default async function DiscoveryProvidersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await getDiscoveryProvidersPageData(params);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm text-slate-500">Админка</Link>
            <h1 className="mt-1 text-3xl font-semibold">Discovery candidates</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Кандидаты не попадают в lab_providers автоматически. Здесь только review-лист для будущего accept/reject.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/discovery/runs" className="border border-slate-300 px-3 py-2 text-sm">Runs</Link>
            <Link href="/discovery/queries" className="border border-slate-300 px-3 py-2 text-sm">Queries</Link>
          </div>
        </div>

        <form className="mt-6 grid gap-3 border-y border-slate-200 bg-white p-4 md:grid-cols-[180px_160px_160px_100px_auto]">
          <input name="city" placeholder="Город" defaultValue={data.city ?? ""} className="h-10 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900" />
          <select name="status" defaultValue={data.status ?? ""} className="h-10 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900">
            <option value="">Все статусы</option>
            <option value="new">new</option>
            <option value="needs_review">needs_review</option>
            <option value="accepted">accepted</option>
            <option value="rejected">rejected</option>
            <option value="duplicate">duplicate</option>
          </select>
          <input name="source" placeholder="Source" defaultValue={data.source ?? ""} className="h-10 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900" />
          <input name="limit" defaultValue="100" className="h-10 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900" />
          <button className="h-10 bg-slate-950 px-4 text-sm font-medium text-white">Фильтр</button>
        </form>

        <section className="mt-6 overflow-x-auto border border-slate-200 bg-white">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-3">Candidate</th>
                <th className="px-3 py-3">City</th>
                <th className="px-3 py-3">Address</th>
                <th className="px-3 py-3">Phone</th>
                <th className="px-3 py-3">Site</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">Confidence</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Duplicate / match</th>
                <th className="px-3 py-3">Suggested action</th>
              </tr>
            </thead>
            <tbody>
              {data.candidates.map((candidate) => {
                const suggestedAction = getRawString(candidate.raw_payload, "suggested_action");
                const duplicateHint = getRawString(candidate.raw_payload, "duplicate_hint");
                return (
                  <tr key={candidate.id} className="border-t border-slate-200 align-top">
                    <td className="px-3 py-3">
                      <div className="font-medium">{candidate.name}</div>
                      <div className="text-xs text-slate-500">{candidate.normalized_name}</div>
                    </td>
                    <td className="px-3 py-3">{candidate.city}</td>
                    <td className="px-3 py-3">{candidate.address || "-"}</td>
                    <td className="px-3 py-3">{candidate.phone || "-"}</td>
                    <td className="px-3 py-3">
                      {candidate.website_url ? (
                        <a className="text-blue-700 underline" href={candidate.website_url} target="_blank" rel="noreferrer">
                          {candidate.domain || candidate.website_url}
                        </a>
                      ) : "-"}
                    </td>
                    <td className="px-3 py-3">{candidate.source_type}</td>
                    <td className="px-3 py-3">{Number(candidate.confidence).toFixed(2)}</td>
                    <td className="px-3 py-3">
                      <span className={statusClassName(candidate.status)}>{candidate.status}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div>{candidate.matched_provider?.display_name || candidate.matched_provider?.name || duplicateHint || "-"}</div>
                      {candidate.duplicate_candidate && (
                        <div className="text-xs text-slate-500">candidate: {candidate.duplicate_candidate.name}</div>
                      )}
                    </td>
                    <td className="px-3 py-3">{suggestedAction || (candidate.status === "duplicate" ? "duplicate" : "review")}</td>
                  </tr>
                );
              })}
              {data.candidates.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-slate-600" colSpan={10}>Пока нет discovery candidates</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function statusClassName(status: string): string {
  if (status === "duplicate") {
    return "border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800";
  }
  if (status === "needs_review" || status === "new") {
    return "border border-blue-300 bg-blue-50 px-2 py-1 text-xs text-blue-800";
  }
  if (status === "accepted") {
    return "border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-800";
  }
  return "border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-700";
}

function getRawString(rawPayload: Record<string, unknown> | null | undefined, key: string): string | undefined {
  const value = rawPayload?.[key];
  return typeof value === "string" ? value : undefined;
}
