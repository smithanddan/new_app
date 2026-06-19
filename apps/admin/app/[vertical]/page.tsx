import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoVerticalPage } from "../lib/seo-vertical-ui";
import { buildSeoPageModel } from "../lib/seo-verticals";

type PageProps = {
  params: Promise<{ vertical: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { vertical } = await params;
  const model = await buildSeoPageModel({ kind: "vertical", verticalSlug: vertical });
  if (!model) return {};
  return {
    title: model.title,
    description: model.description,
    alternates: { canonical: model.canonicalUrl },
    robots: model.indexability === "indexed_ready" ? undefined : { index: false, follow: true },
  };
}

export default async function VerticalLandingPage({ params }: PageProps) {
  const { vertical } = await params;
  const model = await buildSeoPageModel({ kind: "vertical", verticalSlug: vertical });
  if (!model) notFound();
  return <SeoVerticalPage model={model} />;
}
