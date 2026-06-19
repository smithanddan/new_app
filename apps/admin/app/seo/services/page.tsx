import Link from "next/link";
import { updateClinicalServiceSeo } from "../../lib/seo-admin-actions";
import { getSeoServiceStats, getServiceIndexability, getVerticalBySlug, listClinicalServices } from "../../lib/seo-verticals";

export const dynamic = "force-dynamic";

export default async function SeoServicesAdminPage() {
  const [services, analizy] = await Promise.all([
    listClinicalServices(),
    getVerticalBySlug("analizy"),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <SeoAdminNav />
        <h1 className="mt-6 text-3xl font-semibold">SEO services</h1>
        <p className="mt-2 text-sm text-slate-600">Read + toggles для city landing. Полный CRUD услуг в v1 намеренно не включен.</p>

        <section className="mt-6 overflow-x-auto border border-slate-200 bg-white">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-3">Service</th>
                <th className="px-3 py-3">Kind</th>
                <th className="px-3 py-3">Domain</th>
                <th className="px-3 py-3">Slug</th>
                <th className="px-3 py-3">Data</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">City</th>
              </tr>
            </thead>
            <tbody>
              {await Promise.all(services.map(async (service) => {
                const stats = analizy && service.service_kind === "lab_test"
                  ? await getSeoServiceStats(analizy, service)
                  : null;
                const status = analizy && stats ? getServiceIndexability(analizy, service, stats) : "disabled";
                return (
                  <tr key={service.id} className="border-t border-slate-200">
                    <td className="px-3 py-3 font-medium">{service.name_ru}</td>
                    <td className="px-3 py-3">{service.service_kind}</td>
                    <td className="px-3 py-3">{service.domain}</td>
                    <td className="px-3 py-3">{service.seo_slug ?? "-"}</td>
                    <td className="px-3 py-3">{stats ? `${stats.providers_count} providers · ${stats.offers_count} offers` : "-"}</td>
                    <td className="px-3 py-3">{status}</td>
                    <td className="px-3 py-3">
                      <form action={updateClinicalServiceSeo} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={service.id} />
                        <input type="checkbox" name="city_landing_enabled" defaultChecked={service.city_landing_enabled} />
                        <button className="border border-slate-300 px-3 py-1 text-xs" type="submit">Save</button>
                      </form>
                    </td>
                  </tr>
                );
              }))}
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
