import Link from "next/link";
import { SeoHeader } from "../lib/seo-ui";

const tiers = [
  {
    name: "Starter",
    price: "$49/mo",
    description: "Для первых интеграций и MVP.",
    features: ["Compare API", "Cheapest offer API", "API key access"],
  },
  {
    name: "Growth",
    price: "$199/mo",
    description: "Для health apps и агрегаторов.",
    features: ["Basket optimization", "Market stats", "Higher request volume"],
  },
  {
    name: "Enterprise",
    price: "$499+/mo",
    description: "Для лабораторий, клиник и страховых.",
    features: ["Custom dashboard", "Regional analytics", "Dedicated data exports"],
  },
];

type PageProps = {
  searchParams: Promise<{ lead?: string }>;
};

export default async function PricingPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <SeoHeader />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link href="/api-docs" className="text-sm text-slate-500">API docs</Link>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">SaaS API pricing</h1>
        <p className="mt-4 max-w-3xl text-slate-600">
          LabPrice OS продаёт не парсинг, а decision intelligence: сравнение цен, оптимизацию корзины и рыночную аналитику лабораторий.
        </p>

        {params.lead === "sent" ? (
          <div className="mt-6 border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
            Заявка зафиксирована. Следующий шаг - связаться и выдать API key.
          </div>
        ) : null}

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div key={tier.name} className="border border-slate-200 bg-white p-5">
              <div className="text-lg font-semibold">{tier.name}</div>
              <div className="mt-3 text-3xl font-semibold">{tier.price}</div>
              <p className="mt-3 text-sm text-slate-600">{tier.description}</p>
              <ul className="mt-4 grid gap-2 text-sm text-slate-700">
                {tier.features.map((feature) => (
                  <li key={feature}>- {feature}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="mt-8 border border-slate-200 bg-white p-5">
          <h2 className="text-xl font-semibold">Request API access</h2>
          <form action="/api/v1/leads" method="post" className="mt-4 grid gap-3 md:grid-cols-2">
            <input name="email" type="email" required className="h-10 border border-slate-300 px-3 text-sm" placeholder="work@email.com" />
            <input name="company" className="h-10 border border-slate-300 px-3 text-sm" placeholder="Компания" />
            <select name="plan" className="h-10 border border-slate-300 px-3 text-sm" defaultValue="Growth">
              <option>Starter</option>
              <option>Growth</option>
              <option>Enterprise</option>
            </select>
            <input name="use_case" className="h-10 border border-slate-300 px-3 text-sm" placeholder="API, dashboard, white-label" />
            <input name="source" type="hidden" value="pricing_page" />
            <button className="h-10 bg-slate-950 px-4 text-sm font-medium text-white md:col-span-2">
              Request API access
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
