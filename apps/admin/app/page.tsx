import Link from "next/link";

export default function HomePage() {
  const links = [
    { href: "/dashboard", title: "Dashboard", description: "Качество базы, coverage, market spreads и последние запуски" },
    { href: "/compare", title: "Сравнение", description: "Поиск анализа и таблица цен по лабораториям" },
    { href: "/basket", title: "Корзина", description: "Расчёт минимальной стоимости набора анализов" },
    { href: "/match", title: "Матчинг", description: "Unmatched, candidates и blocked позиции" },
    { href: "/runs", title: "Запуски", description: "История scraper_runs и статистика" },
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-950">
      <div className="mx-auto max-w-6xl">
        <section className="border-y border-slate-200 bg-white p-8">
          <p className="text-sm font-medium uppercase text-blue-700">Lab Price Intelligence</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Каталог анализов и цен</h1>
          <p className="mt-4 max-w-2xl text-slate-600">
            Product layer для сравнения лабораторий, корзин анализов, матчинга и истории парсеров.
          </p>
        </section>

        <section className="mt-6 grid gap-3 md:grid-cols-2">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="border border-slate-200 bg-white p-5 hover:border-slate-400">
              <div className="text-lg font-semibold">{link.title}</div>
              <div className="mt-2 text-sm text-slate-600">{link.description}</div>
            </Link>
          ))}
        </section>

        <section className="mt-6 border border-slate-200 bg-white p-5">
          <div className="text-sm font-medium text-slate-700">Legacy</div>
          <div className="mt-3 flex gap-3 text-sm">
            <Link href="/sources" className="border border-slate-300 px-3 py-2">
              Источники
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
