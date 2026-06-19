import { permanentRedirect } from "next/navigation";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function TestSeoPage({ params }: PageProps) {
  const { slug } = await params;
  permanentRedirect(`/analizy/${slug}`);
}
