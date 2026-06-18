"use server";

import { revalidatePath } from "next/cache";
import { createLabCrawlerSupabaseClient } from "@labmind/lab-crawlers/src/supabase-client";

export async function updateVerticalConfig(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const enabled = formData.get("enabled") === "on";
  const priority = Number(formData.get("priority") ?? 100);
  const seoTitleTemplate = String(formData.get("seo_title_template") ?? "");
  const seoDescriptionTemplate = String(formData.get("seo_description_template") ?? "");
  const searchPlaceholder = String(formData.get("search_placeholder") ?? "");

  await createLabCrawlerSupabaseClient()
    .from("vertical_configs")
    .update({
      enabled,
      priority: Number.isFinite(priority) ? priority : 100,
      seo_title_template: seoTitleTemplate,
      seo_description_template: seoDescriptionTemplate,
      search_placeholder: searchPlaceholder,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/seo/verticals");
  revalidatePath("/seo/pages");
  revalidatePath("/sitemap.xml");
}

export async function updateClinicalServiceSeo(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await createLabCrawlerSupabaseClient()
    .from("clinical_services")
    .update({
      city_landing_enabled: formData.get("city_landing_enabled") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/seo/services");
  revalidatePath("/seo/pages");
  revalidatePath("/sitemap.xml");
}

