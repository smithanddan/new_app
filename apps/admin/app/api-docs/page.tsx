import Link from "next/link";
import { SeoHeader } from "../lib/seo-ui";

const endpoints = [
  {
    method: "GET",
    path: "/api/v1/compare?test=Ферритин&city=Москва",
    description: "Все предложения лабораторий по одному canonical-анализу.",
  },
  {
    method: "GET",
    path: "/api/v1/basket-optimize?tests=Глюкоза,ТТГ,Ферритин&city=Москва",
    description: "Оптимальный маршрут: одна лаборатория или split providers.",
  },
  {
    method: "GET",
    path: "/api/v1/market-stats?test=Ферритин&city=Москва",
    description: "Min, max, median, average, promo ratio и provider distribution.",
  },
  {
    method: "GET",
    path: "/api/v1/cheapest?test=Ферритин&city=Москва",
    description: "Самое дешёвое доступное предложение по анализу.",
  },
];

export default function ApiDocsPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <SeoHeader />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link href="/pricing" className="text-sm text-slate-500">Тарифы API</Link>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Pricing Intelligence API</h1>
        <p className="mt-4 max-w-3xl text-slate-600">
          Read-only API поверх LabPrice OS: сравнение анализов, оптимизация корзины и рыночная аналитика для health apps, клиник и агрегаторов.
        </p>

        <section className="mt-8 grid gap-4">
          {endpoints.map((endpoint) => (
            <div key={endpoint.path} className="border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="bg-slate-950 px-2 py-1 text-xs font-semibold text-white">{endpoint.method}</span>
                <code className="text-sm text-slate-800">{endpoint.path}</code>
              </div>
              <p className="mt-3 text-sm text-slate-600">{endpoint.description}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 border border-slate-200 bg-white p-5">
          <h2 className="text-xl font-semibold">Authentication</h2>
          <p className="mt-2 text-sm text-slate-600">
            Если `LABPRICE_API_KEYS` настроен на сервере, каждый запрос должен передавать ключ.
          </p>
          <pre className="mt-4 overflow-x-auto bg-slate-950 p-4 text-sm text-white">{`curl -H "x-api-key: your-key" \\
  "https://your-domain.example/api/v1/cheapest?test=Ферритин&city=Москва"`}</pre>
        </section>
      </div>
    </main>
  );
}
