import Link from "next/link";
import { getComparePageData, DEFAULT_CITY } from "../lib/lab-data";

type PageProps = {
  searchParams: Promise<{ test?: string; city?: string }>;
};

export default async function ComparePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const test = params.test || "Глюкоза";
  const city = params.city || DEFAULT_CITY;
  const data = await getComparePageData({ test, city });
  const row = data.rows[0];
  const offers = row?.offers ?? [];

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <Header title="Сравнение цен" />

        <form className="mt-6 grid gap-3 border-y border-slate-200 bg-white p-4 md:grid-cols-[1fr_180px_auto]">
          <input
            name="test"
            defaultValue={test}
            className="h-10 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
            placeholder="Анализ"
          />
          <input
            name="city"
            defaultValue={city}
            className="h-10 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
            placeholder="Город"
          />
          <button className="h-10 bg-slate-950 px-4 text-sm font-medium text-white">
            Найти
          </button>
        </form>

        <section className="mt-6 overflow-x-auto border border-slate-200 bg-white">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-3">Лаборатория</th>
                <th className="px-3 py-3">Позиция</th>
                <th className="px-3 py-3">Код</th>
                <th className="px-3 py-3">Анализ</th>
                <th className="px-3 py-3">Забор</th>
                <th className="px-3 py-3">Итог</th>
                <th className="px-3 py-3">Тип</th>
                <th className="px-3 py-3">Источник</th>
                <th className="px-3 py-3">Ссылка</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={`${offer.provider.code}:${offer.provider_test_id}:${offer.offer_source}`} className="border-t border-slate-200">
                  <td className="px-3 py-3 font-medium">{offer.provider.name}{offer.offer_type === "promo" ? " (promo)" : ""}</td>
                  <td className="px-3 py-3">{offer.provider_test_name}</td>
                  <td className="px-3 py-3 text-slate-600">{offer.provider_test_code || "-"}</td>
                  <td className="px-3 py-3">{formatRub(offer.effective_price_rub)}</td>
                  <td className="px-3 py-3">{formatRub(offer.biomaterial_price_rub)}</td>
                  <td className="px-3 py-3 font-semibold">{formatRub(offer.total_price_rub)}</td>
                  <td className="px-3 py-3">{offer.offer_type}</td>
                  <td className="px-3 py-3">{offer.offer_source}</td>
                  <td className="px-3 py-3">
                    {offer.source_url ? <a className="text-blue-700 underline" href={offer.source_url}>url</a> : "-"}
                  </td>
                </tr>
              ))}
              {offers.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-slate-600" colSpan={9}>
                    {row?.error === "canonical_test_not_found" ? "Анализ не найден в canonical_tests" : "Нет предложений"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function Header({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Link href="/" className="text-sm text-slate-500">Админка</Link>
        <h1 className="mt-1 text-3xl font-semibold">{title}</h1>
      </div>
      <nav className="flex gap-2 text-sm">
        <Link href="/basket" className="border border-slate-300 px-3 py-2">Корзина</Link>
        <Link href="/match" className="border border-slate-300 px-3 py-2">Матчинг</Link>
        <Link href="/runs" className="border border-slate-300 px-3 py-2">Запуски</Link>
      </nav>
    </div>
  );
}

function formatRub(value: number | undefined): string {
  return value === undefined ? "-" : `${value} ₽`;
}
