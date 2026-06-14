import Link from "next/link";
import { DEFAULT_CITY } from "../lib/lab-data";

type PageProps = {
  searchParams: Promise<{ q?: string; city?: string }>;
};

const quickTests = ["Ферритин", "Глюкоза", "ТТГ", "Витамин D", "Биохимия крови"];
const quickBaskets = [
  "Глюкоза,ТТГ,Ферритин",
  "Ферритин,Витамин D,ТТГ",
  "Глюкоза,Креатинин,Холестерин общий",
];

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.q || "";
  const city = params.city || DEFAULT_CITY;
  const hasQuery = query.trim().length > 0;
  const isBasket = query.includes(",");
  const targetHref = isBasket
    ? `/basket?tests=${encodeURIComponent(query)}&city=${encodeURIComponent(city)}`
    : `/compare?test=${encodeURIComponent(query)}&city=${encodeURIComponent(city)}`;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm text-slate-500">LabPrice OS</Link>
            <h1 className="mt-1 text-3xl font-semibold">Где дешевле сдать анализы</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Введите один анализ для сравнения или несколько через запятую для оптимизации корзины.
            </p>
          </div>
          <Link href="/dashboard" className="border border-slate-300 px-3 py-2 text-sm">Dashboard</Link>
        </div>

        <form className="mt-6 grid gap-3 border-y border-slate-200 bg-white p-4 md:grid-cols-[1fr_180px_auto]">
          <input
            name="q"
            defaultValue={query}
            className="h-11 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
            placeholder="Ферритин или Глюкоза,ТТГ,Ферритин"
          />
          <input
            name="city"
            defaultValue={city}
            className="h-11 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
            placeholder="Город"
          />
          <button className="h-11 bg-slate-950 px-5 text-sm font-medium text-white">
            Найти
          </button>
        </form>

        {hasQuery && (
          <section className="mt-6 border border-slate-200 bg-white p-5">
            <div className="text-xs uppercase text-slate-500">Следующий шаг</div>
            <div className="mt-2 text-lg font-semibold">
              {isBasket ? "Оптимизировать корзину" : "Сравнить предложения"}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {isBasket
                ? "Система подберёт маршрут: одна лаборатория или разделение по лучшим ценам."
                : "Система покажет предложения лабораторий, промо и итоговую цену с забором."}
            </p>
            <Link
              href={targetHref}
              className="mt-4 inline-flex h-10 items-center bg-slate-950 px-4 text-sm font-medium text-white"
            >
              Открыть
            </Link>
          </section>
        )}

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <QuickList title="Популярные анализы" items={quickTests} city={city} type="test" />
          <QuickList title="Готовые корзины" items={quickBaskets} city={city} type="basket" />
        </section>
      </div>
    </main>
  );
}

function QuickList({
  title,
  items,
  city,
  type,
}: {
  title: string;
  items: string[];
  city: string;
  type: "test" | "basket";
}) {
  return (
    <section className="border border-slate-200 bg-white p-5">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-4 grid gap-2">
        {items.map((item) => {
          const href = type === "test"
            ? `/compare?test=${encodeURIComponent(item)}&city=${encodeURIComponent(city)}`
            : `/basket?tests=${encodeURIComponent(item)}&city=${encodeURIComponent(city)}`;
          return (
            <Link key={item} href={href} className="border border-slate-200 px-3 py-2 text-sm hover:border-slate-400">
              {item}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
