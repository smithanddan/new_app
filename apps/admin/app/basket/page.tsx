import Link from "next/link";
import { getBasketPageData, DEFAULT_CITY } from "../lib/lab-data";
import type { PerTestBasket, SingleProviderBasket } from "@labmind/lab-crawlers/src/product-layer";

type PageProps = {
  searchParams: Promise<{ tests?: string; city?: string; mode?: string }>;
};

export default async function BasketPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tests = params.tests || "Глюкоза,ТТГ,Ферритин";
  const city = params.city || DEFAULT_CITY;
  const mode = params.mode === "single-provider" ? "single-provider" : "per-test";
  const data = await getBasketPageData({ tests, city, mode });

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm text-slate-500">Админка</Link>
            <h1 className="mt-1 text-3xl font-semibold">Корзина анализов</h1>
          </div>
          <Link href="/compare" className="border border-slate-300 px-3 py-2 text-sm">Сравнение</Link>
        </div>

        <form className="mt-6 grid gap-3 border-y border-slate-200 bg-white p-4 md:grid-cols-[1fr_180px_190px_auto]">
          <input
            name="tests"
            defaultValue={tests}
            className="h-10 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
            placeholder="Глюкоза,ТТГ,Ферритин"
          />
          <input
            name="city"
            defaultValue={city}
            className="h-10 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
            placeholder="Город"
          />
          <select name="mode" defaultValue={mode} className="h-10 border border-slate-300 px-3 text-sm outline-none focus:border-slate-900">
            <option value="per-test">per-test</option>
            <option value="single-provider">single-provider</option>
          </select>
          <button className="h-10 bg-slate-950 px-4 text-sm font-medium text-white">
            Рассчитать
          </button>
        </form>

        {data.mode === "single-provider"
          ? <SingleProviderView data={data} />
          : <PerTestView data={data} />}
      </div>
    </main>
  );
}

function PerTestView({ data }: { data: PerTestBasket }) {
  return (
    <section className="mt-6">
      <Summary data={[
        ["TOTAL PER TEST", formatRub(data.total_price_rub ?? undefined)],
        ["TOTAL SINGLE PROVIDER", formatRub(data.single_provider_best?.total_price_rub ?? undefined)],
        ["SAVINGS", formatRub(data.savings_vs_single_provider_rub ?? undefined)],
      ]} />
      <SelectedTable selected={data.selected} />
      {data.single_provider_best && (
        <div className="mt-6 overflow-x-auto border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-3">Optimal single provider</th>
                <th className="px-3 py-3">Итого</th>
                <th className="px-3 py-3">Покрытие</th>
                <th className="px-3 py-3">Не хватает</th>
              </tr>
            </thead>
            <tbody>
              <ProviderOptionRow option={data.single_provider_best} requestedCount={data.requested_tests.length} />
            </tbody>
          </table>
        </div>
      )}
      {data.missing.length > 0 && <MissingTable missing={data.missing} />}
    </section>
  );
}

function SingleProviderView({ data }: { data: SingleProviderBasket }) {
  return (
    <section className="mt-6 grid gap-6">
      <div>
        <Summary data={[
          ["TOTAL SINGLE PROVIDER", formatRub(data.selected_provider?.total_price_rub ?? undefined)],
          ["TOTAL PER TEST", formatRub(data.per_test_total_price_rub ?? undefined)],
          ["SAVINGS", formatRub(data.savings_vs_single_provider_rub ?? undefined)],
        ]} />
        {data.selected_provider ? <SelectedTable selected={data.selected_provider.selected} /> : <p className="text-slate-600">Нет полного покрытия.</p>}
      </div>

      <div className="overflow-x-auto border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-3">Лаборатория</th>
              <th className="px-3 py-3">Итого</th>
              <th className="px-3 py-3">Покрытие</th>
              <th className="px-3 py-3">Не хватает</th>
            </tr>
          </thead>
          <tbody>
            {data.provider_options.map((option) => (
              <ProviderOptionRow key={option.provider.code} option={option} requestedCount={data.requested_tests.length} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Summary({ data }: { data: Array<[string, string]> }) {
  return (
    <div className="mb-6 grid gap-3 md:grid-cols-3">
      {data.map(([label, value]) => (
        <div key={label} className="border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
        </div>
      ))}
    </div>
  );
}

function ProviderOptionRow({ option, requestedCount }: { option: SingleProviderBasket["provider_options"][number]; requestedCount: number }) {
  return (
    <tr className="border-t border-slate-200">
      <td className="px-3 py-3 font-medium">
        {"name" in option.provider ? option.provider.name : option.provider.code}
        {option.complete ? <span className="ml-2 text-xs uppercase text-emerald-700">complete</span> : null}
      </td>
      <td className="px-3 py-3">{formatRub(option.total_price_rub ?? undefined)}</td>
      <td className="px-3 py-3">{option.selected.length}/{requestedCount}</td>
      <td className="px-3 py-3">{option.missing.map((item) => item.test).join(", ") || "-"}</td>
    </tr>
  );
}

function SelectedTable({ selected }: { selected: PerTestBasket["selected"] }) {
  return (
    <div className="overflow-x-auto border border-slate-200 bg-white">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-3 py-3">Анализ</th>
            <th className="px-3 py-3">Лаборатория</th>
            <th className="px-3 py-3">Позиция</th>
            <th className="px-3 py-3">Код</th>
            <th className="px-3 py-3">Анализ цена</th>
            <th className="px-3 py-3">Забор</th>
            <th className="px-3 py-3">Итого</th>
            <th className="px-3 py-3">URL</th>
          </tr>
        </thead>
        <tbody>
          {selected.map((item) => (
            <tr key={`${item.test}:${item.offer.provider.code}:${item.offer.provider_test_id}`} className="border-t border-slate-200">
              <td className="px-3 py-3 font-medium">{item.test}</td>
              <td className="px-3 py-3">{item.offer.provider.name}</td>
              <td className="px-3 py-3">{item.offer.provider_test_name}</td>
              <td className="px-3 py-3 text-slate-600">{item.offer.provider_test_code || "-"}</td>
              <td className="px-3 py-3">{formatRub(item.offer.effective_price_rub)}</td>
              <td className="px-3 py-3">{formatRub(item.offer.biomaterial_price_rub)}</td>
              <td className="px-3 py-3 font-semibold">{formatRub(item.offer.total_price_rub)}</td>
              <td className="px-3 py-3">{item.offer.source_url ? <a className="text-blue-700 underline" href={item.offer.source_url}>url</a> : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MissingTable({ missing }: { missing: PerTestBasket["missing"] }) {
  return (
    <div className="mt-6 overflow-x-auto border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-3 py-3">Анализ</th>
            <th className="px-3 py-3">Причина</th>
          </tr>
        </thead>
        <tbody>
          {missing.map((item) => (
            <tr key={item.test} className="border-t border-slate-200">
              <td className="px-3 py-3">{item.test}</td>
              <td className="px-3 py-3">{item.error}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatRub(value: number | undefined): string {
  return value === undefined ? "-" : `${value} ₽`;
}
