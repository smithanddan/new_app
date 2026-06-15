import Link from "next/link";
import { GeoLocationFields } from "../components/GeoLocationFields";
import { DEFAULT_CITY } from "../lib/lab-data";

type PageProps = {
  searchParams: Promise<{ q?: string; city?: string; lat?: string; lng?: string }>;
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
  const lat = params.lat || "";
  const lng = params.lng || "";
  const hasQuery = query.trim().length > 0;
  const isBasket = query.includes(",");
  const targetHref = buildResultHref({ query, city, lat, lng, type: isBasket ? "basket" : "test" });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-950 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/" className="text-sm text-slate-500">LabPrice OS</Link>
            <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Где дешевле и ближе сдать анализы
            </h1>
            <p className="mt-3 max-w-2xl text-base text-slate-600 sm:text-sm">
              Найдите один анализ или соберите корзину. Гео нужно только для подсказки ближайшей точки.
            </p>
          </div>
          <Link href="/dashboard" className="hidden border border-slate-300 px-3 py-2 text-sm sm:inline-flex">Dashboard</Link>
        </div>

        <form className="mt-6 grid gap-3 border-y border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_160px_auto]">
          <input
            name="q"
            defaultValue={query}
            className="h-14 border border-slate-300 px-4 text-base outline-none focus:border-slate-900 md:col-span-1"
            placeholder="Какой анализ ищем?"
          />
          <input
            name="city"
            defaultValue={city}
            className="h-12 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 md:h-14"
            placeholder="Город"
          />
          <button className="h-12 bg-slate-950 px-5 text-sm font-medium text-white md:h-14">
            Найти
          </button>
          <div className="md:col-span-3">
            <GeoLocationFields initialLat={lat} initialLng={lng} updateUrl />
          </div>
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
          <QuickList title="Популярные анализы" items={quickTests} city={city} lat={lat} lng={lng} type="test" />
          <QuickList title="Готовые корзины" items={quickBaskets} city={city} lat={lat} lng={lng} type="basket" />
        </section>
      </div>
    </main>
  );
}

function QuickList({
  title,
  items,
  city,
  lat,
  lng,
  type,
}: {
  title: string;
  items: string[];
  city: string;
  lat: string;
  lng: string;
  type: "test" | "basket";
}) {
  return (
    <section className="border border-slate-200 bg-white p-5">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-4 grid gap-2">
        {items.map((item) => {
          const href = buildResultHref({ query: item, city, lat, lng, type });
          return (
            <Link key={item} href={href} className="border border-slate-200 px-3 py-3 text-sm hover:border-slate-400">
              {item}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function buildResultHref(input: {
  query: string;
  city: string;
  lat: string;
  lng: string;
  type: "test" | "basket";
}): string {
  const params = new URLSearchParams();
  params.set(input.type === "test" ? "test" : "tests", input.query);
  params.set("city", input.city);
  if (input.lat && input.lng) {
    params.set("lat", input.lat);
    params.set("lng", input.lng);
  }

  return `${input.type === "test" ? "/compare" : "/basket"}?${params.toString()}`;
}
