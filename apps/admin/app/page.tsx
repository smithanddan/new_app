import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-950">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Web Monitor</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Админка мониторинга сайтов</h1>
          <p className="mt-4 max-w-2xl text-slate-600">
            Источники, запуски парсинга, сырые снимки страниц, извлечённые предложения, история цен и алерты.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/sources" className="rounded-xl bg-slate-950 px-4 py-2 text-white">
              Источники
            </Link>
            <Link href="/runs" className="rounded-xl border border-slate-300 px-4 py-2">
              Запуски
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
