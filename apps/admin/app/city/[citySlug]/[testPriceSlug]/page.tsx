import { permanentRedirect } from "next/navigation";
import { resolveTestFromPriceSlug } from "../../../lib/seo";

type PageProps = {
  params: Promise<{ citySlug: string; testPriceSlug: string }>;
};

export default async function CityTestPricePage({ params }: PageProps) {
  const { citySlug, testPriceSlug } = await params;
  permanentRedirect(`/${citySlug}/analizy/${resolveTestFromPriceSlug(testPriceSlug)}`);
}
