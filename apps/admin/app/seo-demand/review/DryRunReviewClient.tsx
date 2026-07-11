"use client";

import { useMemo, useState } from "react";

type ReviewResult = {
  ok: boolean;
  verdict: string;
  next_step: string;
  reason: string;
  provider: string;
  region: string;
  mode: string;
  totals: {
    catalog_parsed: number;
    prices_parsed: number;
    promotions_parsed: number;
    errors_count: number;
  };
  runs: Array<{
    provider: string;
    region: string;
    mode: string;
    transport: string;
    catalog_parsed: number;
    prices_parsed: number;
    promotions_parsed: number;
    errors_count: number;
    errors: string[];
    verdict: string;
    next_step: string;
    reason: string;
  }>;
  warnings: string[];
};

const SAMPLE_REPORT = JSON.stringify({
  provider: "cmd",
  region: "msk",
  mode: "dry-run",
  runs: [{
    provider: "cmd",
    region: "msk",
    mode: "dry-run",
    transport: { mode: "http", fallback: "playwright" },
    scraper_run_id: null,
    catalogParsed: 1,
    pricesParsed: 1,
    promotionsParsed: 0,
    promotionItemsParsed: 0,
    providerTestsUpserted: 1,
    pricesInserted: 1,
    pricesSkipped: 0,
    promotionsUpserted: 0,
    promotionItemsUpserted: 0,
    errorsCount: 0,
    errors: [],
  }],
  totals: {
    catalogParsed: 1,
    pricesParsed: 1,
    promotionsParsed: 0,
    promotionItemsParsed: 0,
    providerTestsUpserted: 1,
    pricesInserted: 1,
    pricesSkipped: 0,
    promotionsUpserted: 0,
    promotionItemsUpserted: 0,
    errorsCount: 0,
  },
  errors: [],
}, null, 2);

export function DryRunReviewClient() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const canSubmit = input.trim().length > 0 && !loading;
  const commandHint = useMemo(() => {
    if (!result) {
      return "";
    }
    if (result.next_step === "write") {
      return `pnpm --filter @labmind/lab-crawlers crawler:run -- --provider ${result.provider} --region ${result.region} --write`;
    }
    return "";
  }, [result]);

  async function review() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const parsed = JSON.parse(input);
      const response = await fetch("/api/seo-demand/dry-run-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const payload = await response.json() as ReviewResult;
      setResult(payload);
      if (!response.ok) {
        setError(payload.reason || "Dry-run review failed.");
      }
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : String(reviewError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold">Dry-run JSON</h2>
          <p className="mt-1 text-xs text-slate-500">Вставь output команды crawler:run --dry-run. Review ничего не пишет в базу.</p>
        </div>
        <div className="p-4">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="min-h-[440px] w-full border border-slate-300 p-3 font-mono text-xs leading-5 outline-none focus:border-slate-900"
            placeholder={SAMPLE_REPORT}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={review}
              disabled={!canSubmit}
              className="h-10 bg-slate-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? "Review..." : "Review dry-run"}
            </button>
            <button
              type="button"
              onClick={() => {
                setInput(SAMPLE_REPORT);
                setResult(null);
                setError("");
              }}
              className="h-10 border border-slate-300 bg-white px-4 text-sm"
            >
              Load sample
            </button>
          </div>
          {error ? <div className="mt-3 border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}
        </div>
      </div>

      <div className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold">Review result</h2>
          <p className="mt-1 text-xs text-slate-500">Вердикт показывает, можно ли готовить write или нужен следующий provider/parser.</p>
        </div>
        <div className="p-4">
          {result ? (
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-4">
                <Metric label="Verdict" value={result.verdict} />
                <Metric label="Next" value={result.next_step} />
                <Metric label="Tests" value={result.totals.catalog_parsed} />
                <Metric label="Prices" value={result.totals.prices_parsed} />
              </div>
              <div className="border border-slate-200 p-3">
                <div className="text-sm font-medium">{result.reason}</div>
                <div className="mt-1 text-xs text-slate-500">{result.provider} · {result.region} · {result.mode}</div>
              </div>
              {commandHint ? (
                <code className="block whitespace-normal break-words border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  {commandHint}
                </code>
              ) : null}
              {result.warnings.length > 0 ? (
                <div className="border border-amber-200 bg-amber-50 p-3">
                  <div className="text-sm font-medium text-amber-900">Warnings</div>
                  <ul className="mt-2 grid gap-1 text-xs text-amber-900">
                    {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </div>
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                    <tr>
                      <th className="px-3 py-3">Provider</th>
                      <th className="px-3 py-3">Parsed</th>
                      <th className="px-3 py-3">Transport</th>
                      <th className="px-3 py-3">Verdict</th>
                      <th className="px-3 py-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.runs.map((run) => (
                      <tr key={`${run.provider}:${run.region}`} className="border-t border-slate-200 align-top">
                        <td className="px-3 py-3">
                          <div className="font-medium">{run.provider}</div>
                          <div className="text-xs text-slate-500">{run.region}</div>
                        </td>
                        <td className="px-3 py-3 text-xs">
                          tests {run.catalog_parsed}<br />
                          prices {run.prices_parsed}<br />
                          errors {run.errors_count}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">{run.transport}</td>
                        <td className="px-3 py-3">{run.verdict}</td>
                        <td className="px-3 py-3 text-xs leading-5 text-slate-600">{run.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 p-6 text-sm text-slate-600">Review result появится здесь после проверки JSON.</div>
          )}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-slate-200 p-3">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
