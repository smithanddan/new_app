import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoVerticalPage } from "../../../lib/seo-vertical-ui";
import { buildSeoPageModel } from "../../../lib/seo-verticals";

type PageProps = {
  params: Promise<{ slug: string; service: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, service } = await params;
  const model = await buildSeoPageModel({ kind: "compare_service", verticalSlug: slug, serviceSlug: service });
  if (!model) return {};
  return {
    title: model.title,
    description: model.description,
    alternates: { canonical: model.canonicalUrl },
    robots: model.indexability === "indexed_ready" ? undefined : { index: false, follow: true },
  };
}

export default async function CompareVerticalServicePage({ params }: PageProps) {
  const { slug, service } = await params;
  const model = await buildSeoPageModel({ kind: "compare_service", verticalSlug: slug, serviceSlug: service });
  if (!model) notFound();
  return <SeoVerticalPage model={model} />;
}
