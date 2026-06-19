import { permanentRedirect } from "next/navigation";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CompareSeoPage({ params }: PageProps) {
  const { slug } = await params;
  permanentRedirect(`/compare/analizy/${slug}`);
}
