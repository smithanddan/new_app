import { CheerioCrawler, log } from "crawlee";
import { supabase } from "../db.js";
import { extractOffersWithCss } from "../extractors/css.js";

type Source = {
  id: string;
  name: string;
  kind: string;
  extractor_type: "css" | "llm" | "custom";
  extractor_config: unknown;
};

type SourcePage = {
  id: string;
  source_id: string;
  url: string;
};

export async function runSource(sourceId?: string) {
  let sourceQuery = supabase.from("sources").select("*").eq("enabled", true);

  if (sourceId) {
    sourceQuery = sourceQuery.eq("id", sourceId);
  }

  const { data: sources, error: sourceError } = await sourceQuery;
  if (sourceError) throw sourceError;

  for (const source of (sources ?? []) as Source[]) {
    await runOneSource(source);
  }
}

async function runOneSource(source: Source) {
  const { data: run, error: runError } = await supabase
    .from("scrape_runs")
    .insert({
      source_id: source.id,
      status: "running",
      started_at: new Date().toISOString()
    })
    .select("*")
    .single();

  if (runError) throw runError;

  try {
    const { data: pages, error: pagesError } = await supabase
      .from("source_pages")
      .select("*")
      .eq("source_id", source.id)
      .eq("enabled", true);

    if (pagesError) throw pagesError;

    const crawler = new CheerioCrawler({
      maxConcurrency: Number(process.env.WORKER_CONCURRENCY ?? 3),
      requestHandler: async ({ request, body }) => {
        const page = (pages as SourcePage[]).find((p) => p.url === request.url);
        const html = body.toString("utf-8");

        const { data: rawSnapshot, error: rawError } = await supabase
          .from("raw_snapshots")
          .insert({
            scrape_run_id: run.id,
            source_id: source.id,
            source_page_id: page?.id ?? null,
            url: request.url,
            content_type: "text/html",
            body_text: html.slice(0, 250000),
            fetched_at: new Date().toISOString()
          })
          .select("*")
          .single();

        if (rawError) throw rawError;

        if (source.extractor_type === "css") {
          const offers = extractOffersWithCss(html, request.url, source.extractor_config);

          for (const offer of offers) {
            const { data: extracted, error: offerError } = await supabase
              .from("extracted_offers")
              .insert({
                scrape_run_id: run.id,
                raw_snapshot_id: rawSnapshot.id,
                source_id: source.id,
                title: offer.title,
                price_amount: offer.priceAmount,
                currency: offer.currency,
                availability: offer.availability,
                source_url: offer.sourceUrl,
                raw: offer.raw
              })
              .select("*")
              .single();

            if (offerError) throw offerError;

            if (offer.priceAmount !== null) {
              await supabase.from("price_snapshots").insert({
                extracted_offer_id: extracted.id,
                source_id: source.id,
                price_amount: offer.priceAmount,
                currency: offer.currency,
                captured_at: new Date().toISOString()
              });
            }
          }

          log.info(`Extracted ${offers.length} offers from ${request.url}`);
        }
      },
      failedRequestHandler: async ({ request, error }) => {
        await supabase.from("alerts").insert({
          source_id: source.id,
          severity: "error",
          type: "scrape_failed",
          title: `Failed to scrape ${request.url}`,
          message: error?.message ?? "Unknown error"
        });
      }
    });

    await crawler.run((pages ?? []).map((page: SourcePage) => page.url));

    await supabase
      .from("scrape_runs")
      .update({ status: "success", finished_at: new Date().toISOString() })
      .eq("id", run.id);
  } catch (error) {
    await supabase
      .from("scrape_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : String(error)
      })
      .eq("id", run.id);

    throw error;
  }
}
