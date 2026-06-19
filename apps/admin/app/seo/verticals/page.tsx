import Link from "next/link";
import { updateVerticalConfig } from "../../lib/seo-admin-actions";
import { isVetVerticalEnabled, listVerticalConfigs } from "../../lib/seo-verticals";

export const dynamic = "force-dynamic";

export default async function SeoVerticalsAdminPage() {
  const verticals = await listVerticalConfigs();

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <SeoAdminNav />
        <h1 className="mt-6 text-3xl font-semibold">SEO verticals</h1>
        <p className="mt-2 text-sm text-slate-600">
          Управление конфигами вертикалей. Veterinary env gate: <span className="font-medium">{isVetVerticalEnabled() ? "enabled" : "disabled"}</span>.
        </p>

        <div className="mt-6 grid gap-4">
          {verticals.map((vertical) => (
            <form key={vertical.id} action={updateVerticalConfig} className="border border-slate-200 bg-white p-4">
              <input type="hidden" name="id" value={vertical.id} />
              <div className="grid gap-4 lg:grid-cols-[220px_1fr_auto]">
                <div>
                  <div className="text-lg font-semibold">{vertical.name}</div>
                  <div className="mt-1 text-sm text-slate-600">/{vertical.slug}</div>
                  <div className="mt-1 text-xs uppercase text-slate-500">{vertical.domain} · {vertical.service_kinds.join(", ")}</div>
                </div>
                <div className="grid gap-3">
                  <label className="grid gap-1 text-sm">
                    Title template
                    <input className="border border-slate-300 px-3 py-2" name="seo_title_template" defaultValue={vertical.seo_title_template} />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Description template
                    <input className="border border-slate-300 px-3 py-2" name="seo_description_template" defaultValue={vertical.seo_description_template} />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Search placeholder
                    <input className="border border-slate-300 px-3 py-2" name="search_placeholder" defaultValue={vertical.search_placeholder ?? ""} />
                  </label>
                </div>
                <div className="grid content-start gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="enabled" defaultChecked={vertical.enabled} />
                    Enabled
                  </label>
                  <label className="grid gap-1 text-sm">
                    Priority
                    <input className="w-24 border border-slate-300 px-3 py-2" name="priority" type="number" defaultValue={vertical.priority} />
                  </label>
                  <button className="bg-slate-950 px-4 py-2 text-sm font-medium text-white" type="submit">
                    Save
                  </button>
                </div>
              </div>
            </form>
          ))}
        </div>
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
