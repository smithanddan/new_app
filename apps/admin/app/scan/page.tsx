import Link from "next/link";
import { ReferralScannerClient } from "../components/ReferralScannerClient";
import { DEFAULT_CITY } from "../lib/lab-data";

type PageProps = {
  searchParams: Promise<{ city?: string; lat?: string; lng?: string }>;
};

export default async function ScanPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const city = params.city || DEFAULT_CITY;
  const lat = params.lat || "";
  const lng = params.lng || "";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-950 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/search" className="text-sm text-slate-500">Поиск</Link>
            <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Сканировать направление
            </h1>
            <p className="mt-3 max-w-2xl text-base text-slate-600 sm:text-sm">
              Загрузите фото печатного направления или вставьте текст из мессенджера. Мы соберём корзину анализов и покажем, где дешевле и ближе.
            </p>
          </div>
          <Link href="/basket" className="border border-slate-300 px-3 py-2 text-sm">Корзина</Link>
        </div>

        <div className="mt-6 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          MVP распознаёт печатный текст и скриншоты. Рукописные назначения пока лучше перепечатать вручную.
        </div>

        <section className="mt-6">
          <ReferralScannerClient city={city} lat={lat} lng={lng} />
        </section>
      </div>
    </main>
  );
}
