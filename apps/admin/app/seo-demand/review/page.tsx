import Link from "next/link";
import { DryRunReviewClient } from "./DryRunReviewClient";

export default function SeoDemandReviewPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/seo-demand" className="text-sm text-slate-500">SEO demand</Link>
            <h1 className="mt-1 text-3xl font-semibold">Dry-run review</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Проверка JSON-результата crawler dry-run перед match/write решением. Страница не запускает crawler и не пишет в Supabase.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            <Link href="/seo-demand" className="border border-slate-300 bg-white px-3 py-2">SEO demand</Link>
            <Link href="/api/seo-demand/dry-run-review" className="border border-slate-300 bg-white px-3 py-2">Review API</Link>
          </nav>
        </div>
        <DryRunReviewClient />
      </div>
    </main>
  );
}
