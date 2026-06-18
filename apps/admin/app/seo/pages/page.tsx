import Link from "next/link";
import { getSeoAdminInventory } from "../../lib/seo-verticals";

export const dynamic = "force-dynamic";

export default async function SeoPagesAdminPage() {
  const pages = await getSeoAdminInventory();

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <SeoAdminNav />
        <h1 className="mt-6 text-3xl font-semibold">SEO pages</h1>
        <p className="mt-2 text-sm text-slate-600">Generated URL inventory и indexability status.</p>

        <section className="mt-6 overflow-x-auto border border-slate-200 bg-white">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-3">URL</th>
                <th className="px-3 py-3">Vertical</th>
                <th className="px-3 py-3">Service</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Data</th>
                <th className="px-3 py-3">Canonical</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.canonicalUrl} className="border-t border-slate-200">
                  <td className="px-3 py-3">
                    <Link className="text-blue-700" href={page.canonicalPath}>{page.canonicalPath}</Link>
                  </td>
                  <td className="px-3 py-3">{page.vertical.name}</td>
                  <td className="px-3 py-3">{page.service.name_ru}</td>
                  <td className="px-3 py-3">{page.indexability}</td>
                  <td className="px-3 py-3">{page.stats ? `${page.stats.providers_count} providers · ${page.stats.offers_count} offers` : "-"}</td>
                  <td className="px-3 py-3 text-xs text-slate-600">{page.canonicalUrl}</td>
                </tr>
              ))}
              {pages.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-slate-600" colSpan={6}>Нет SEO pages для отображения.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function SeoAdminNav() {
  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      <Link className="border border-slate-300 bg-white px-3 py-2" href="/seo/verticals">Verticals</Link>
      <Link className="border border-slate-300 bg-white px-3 py-2" href="/seo/services">Services</Link>
      <Link className="border border-slate-300 bg-white px-3 py-2" href="/seo/pages">Pages</Link>
      <Link className="border border-slate-300 bg-white px-3 py-2" href="/dashboard">Dashboard</Link>
    </nav>
  );
}
