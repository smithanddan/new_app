import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoVerticalPage } from "../../lib/seo-vertical-ui";
import { buildSeoPageModel } from "../../lib/seo-verticals";
import { getCityBySlug } from "../../lib/seo";

type PageProps = {
  params: Promise<{ vertical: string; segments: string[] }>;
};

function parseSeoParams(params: { vertical: string; segments: string[] }) {
  const city = getCityBySlug(params.vertical);
  if (city && params.segments.length === 2) {
    return {
      kind: "city_service" as const,
      citySlug: params.vertical,
      verticalSlug: params.segments[0],
      serviceSlug: params.segments[1],
    };
  }

  if (params.segments.length === 1) {
    return {
      kind: "service" as const,
      verticalSlug: params.vertical,
      serviceSlug: params.segments[0],
    };
  }

  return null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const parsed = parseSeoParams(await params);
  if (!parsed) return {};
  const model = await buildSeoPageModel(parsed);
  if (!model) return {};
  return {
    title: model.title,
    description: model.description,
    alternates: { canonical: model.canonicalUrl },
    robots: model.indexability === "indexed_ready" ? undefined : { index: false, follow: true },
  };
}

export default async function VerticalServicePage({ params }: PageProps) {
  const parsed = parseSeoParams(await params);
  if (!parsed) notFound();
  const model = await buildSeoPageModel(parsed);
  if (!model) notFound();
  return <SeoVerticalPage model={model} />;
}
