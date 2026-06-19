import "server-only";

import type { ProductCompareRow, ProductOffer } from "@labmind/lab-crawlers/src/product-layer";
import { createLabCrawlerSupabaseClient } from "@labmind/lab-crawlers/src/supabase-client";
import { DEFAULT_CITY, getComparePageData, getRepository } from "./lab-data";
import { getCanonicalSlug, getCityBySlug, getSeoTestsSafe, getSiteUrl, SEO_CITIES, slugify } from "./seo";

export type VerticalDomain = "human" | "veterinary";
export type ServiceKind =
  | "lab_test"
  | "ultrasound"
  | "mri"
  | "ct"
  | "doctor_visit"
  | "dentistry"
  | "veterinary"
  | "procedure"
  | "other";

export type VerticalConfig = {
  id: string;
  code: string;
  name: string;
  slug: string;
  domain: VerticalDomain;
  service_kinds: ServiceKind[];
  seo_title_template: string;
  seo_description_template: string;
  search_placeholder: string | null;
  enabled: boolean;
  priority: number;
};

export type ClinicalService = {
  id: string;
  code: string | null;
  name_ru: string;
  domain: VerticalDomain;
  service_kind: ServiceKind;
  seo_slug: string | null;
  city_landing_enabled: boolean;
  is_active: boolean;
  canonical_test_id: string | null;
  aliases: string[];
  description: string | null;
};

export type SeoPageKind = "vertical" | "service" | "city_service" | "compare_service";
export type SeoIndexabilityStatus = "indexed_ready" | "not_enough_data" | "disabled" | "duplicate_risk";

export type SeoServiceStats = {
  providers_count: number;
  offers_count: number;
  min_price_rub: number | null;
  max_price_rub: number | null;
  median_price_rub: number | null;
  cheapest_provider_name: string | null;
  cheapest_total_rub: number | null;
  nearby_providers: Array<{
    provider_name: string;
    address?: string;
    source_url?: string;
  }>;
};

export type SeoPageModel = {
  kind: SeoPageKind;
  canonicalPath: string;
  canonicalUrl: string;
  vertical: VerticalConfig;
  service?: ClinicalService;
  city?: string;
  citySlug?: string;
  title: string;
  description: string;
  indexability: SeoIndexabilityStatus;
  stats: SeoServiceStats | null;
  compareRow?: ProductCompareRow;
};

export const ENOUGH_DATA_PROVIDERS = 2;
export const ENOUGH_DATA_OFFERS = 2;
export const DEFAULT_VERTICAL_SLUG = "analizy";

const FALLBACK_VERTICALS: VerticalConfig[] = [
  verticalFallback("analizy", "Анализы", "analizy", "human", ["lab_test"], true, 10, "Найти анализ"),
  verticalFallback("uzi", "УЗИ", "uzi", "human", ["ultrasound"], false, 20, "Найти УЗИ"),
  verticalFallback("mrt_kt", "МРТ/КТ", "mrt-kt", "human", ["mri", "ct"], false, 30, "Найти МРТ или КТ"),
  verticalFallback("vrachi", "Врачи", "vrachi", "human", ["doctor_visit"], false, 40, "Найти врача"),
  verticalFallback("kliniki", "Клиники", "kliniki", "human", ["procedure", "other"], false, 50, "Найти услугу"),
  verticalFallback("stomatologiya", "Стоматология", "stomatologiya", "human", ["dentistry"], false, 60, "Найти стоматологическую услугу"),
  verticalFallback("veterinariya", "Ветеринария", "veterinariya", "veterinary", ["veterinary"], false, 70, "Найти ветуслугу"),
];

export function isVetVerticalEnabled(): boolean {
  return process.env.VET_VERTICAL_ENABLED === "true";
}

export async function listVerticalConfigs(): Promise<VerticalConfig[]> {
  try {
    const { data, error } = await createLabCrawlerSupabaseClient()
      .from("vertical_configs")
      .select("id, code, name, slug, domain, service_kinds, seo_title_template, seo_description_template, search_placeholder, enabled, priority")
      .order("priority", { ascending: true });

    if (error) throw error;
    const rows = (data ?? []) as VerticalConfig[];
    return rows.length > 0 ? rows.map(normalizeVertical) : FALLBACK_VERTICALS;
  } catch {
    return FALLBACK_VERTICALS;
  }
}

export async function getVerticalBySlug(slug: string): Promise<VerticalConfig | undefined> {
  const verticals = await listVerticalConfigs();
  return verticals.find((vertical) => vertical.slug === slug || vertical.code === slug);
}

export async function listClinicalServices(): Promise<ClinicalService[]> {
  try {
    const { data, error } = await createLabCrawlerSupabaseClient()
      .from("clinical_services")
      .select("id, code, name_ru, domain, service_kind, seo_slug, city_landing_enabled, is_active, canonical_test_id, aliases, description")
      .order("name_ru", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as ClinicalService[]).map(normalizeService);
  } catch {
    const tests = await getSeoTestsSafe();
    return tests.map((test) => ({
      id: test.id,
      code: `lab_${test.code.toLowerCase()}`,
      name_ru: test.name_ru,
      domain: "human",
      service_kind: "lab_test",
      seo_slug: getCanonicalSlug(test),
      city_landing_enabled: true,
      is_active: true,
      canonical_test_id: test.id,
      aliases: test.aliases,
      description: null,
    }));
  }
}

export async function getServicesForVertical(vertical: VerticalConfig): Promise<ClinicalService[]> {
  const services = await listClinicalServices();
  return services.filter((service) => (
    service.is_active
    && service.domain === vertical.domain
    && vertical.service_kinds.includes(service.service_kind)
    && Boolean(service.seo_slug)
  ));
}

export async function resolveSeoService(vertical: VerticalConfig, serviceSlug: string): Promise<ClinicalService | undefined> {
  const services = await getServicesForVertical(vertical);
  return services.find((service) => service.seo_slug === serviceSlug || service.code === serviceSlug);
}

export async function buildSeoPageModel(input: {
  kind: SeoPageKind;
  verticalSlug: string;
  serviceSlug?: string;
  citySlug?: string;
  includeDisabled?: boolean;
}): Promise<SeoPageModel | null> {
  const vertical = await getVerticalBySlug(input.verticalSlug);
  if (!vertical || isVerticalBlocked(vertical)) return null;
  if (!input.includeDisabled && !vertical.enabled) return null;

  const city = input.citySlug ? getCityBySlug(input.citySlug) : SEO_CITIES[0];
  if (input.citySlug && !city) return null;

  if (input.kind === "vertical") {
    const services = await getServicesForVertical(vertical);
    const readyServices = await getServicesWithStats(vertical, services);
    const canonicalPath = `/${vertical.slug}`;
    return {
      kind: "vertical",
      canonicalPath,
      canonicalUrl: `${getSiteUrl()}${canonicalPath}`,
      vertical,
      city: city?.name ?? DEFAULT_CITY,
      citySlug: city?.slug ?? "moscow",
      title: `${vertical.name}: сравнение цен и доступности | LabPrice OS`,
      description: `Единая витрина ${vertical.name.toLowerCase()}: сравнение цен, диапазонов и провайдеров без медицинских рекомендаций.`,
      indexability: readyServices.length > 0 ? "indexed_ready" : "not_enough_data",
      stats: null,
    };
  }

  if (!input.serviceSlug) return null;
  const service = await resolveSeoService(vertical, input.serviceSlug);
  if (!service) return null;

  const cityName = city?.name ?? DEFAULT_CITY;
  const stats = await getSeoServiceStats(vertical, service, cityName);
  const indexability = getServiceIndexability(vertical, service, stats);
  const path = buildSeoPath(input.kind, vertical.slug, service.seo_slug ?? input.serviceSlug, city?.slug);
  const tokens = {
    service: service.name_ru,
    vertical: vertical.name,
    city: cityName,
    min_price: formatRub(stats.min_price_rub),
    median_price: formatRub(stats.median_price_rub),
    providers_count: String(stats.providers_count),
  };

  return {
    kind: input.kind,
    canonicalPath: path,
    canonicalUrl: `${getSiteUrl()}${path}`,
    vertical,
    service,
    city: cityName,
    citySlug: city?.slug ?? "moscow",
    title: renderTemplate(vertical.seo_title_template, tokens),
    description: renderTemplate(vertical.seo_description_template, tokens),
    indexability,
    stats,
    compareRow: await getLabCompareRowSafe(service, cityName),
  };
}

export async function getIndexableSeoPages(): Promise<SeoPageModel[]> {
  const pages: SeoPageModel[] = [];
  const seen = new Set<string>();
  const verticals = (await listVerticalConfigs()).filter((vertical) => vertical.enabled && !isVerticalBlocked(vertical));

  for (const vertical of verticals) {
    const services = await getServicesForVertical(vertical);
    const serviceModels: SeoPageModel[] = [];

    for (const service of services) {
      const serviceSlug = service.seo_slug;
      if (!serviceSlug) continue;
      const serviceModel = await buildSeoPageModel({ kind: "service", verticalSlug: vertical.slug, serviceSlug });
      if (serviceModel?.indexability === "indexed_ready") serviceModels.push(serviceModel);
      const cityModel = service.city_landing_enabled
        ? await buildSeoPageModel({ kind: "city_service", verticalSlug: vertical.slug, serviceSlug, citySlug: "moscow" })
        : null;
      if (cityModel?.indexability === "indexed_ready") serviceModels.push(cityModel);
      const compareModel = await buildSeoPageModel({ kind: "compare_service", verticalSlug: vertical.slug, serviceSlug });
      if (compareModel?.indexability === "indexed_ready") serviceModels.push(compareModel);
    }

    if (serviceModels.length > 0) {
      const verticalModel = await buildSeoPageModel({ kind: "vertical", verticalSlug: vertical.slug });
      if (verticalModel) pages.push(verticalModel);
    }
    pages.push(...serviceModels);
  }

  return pages.filter((page) => {
    if (seen.has(page.canonicalUrl)) return false;
    seen.add(page.canonicalUrl);
    return true;
  });
}

export async function getSeoAdminInventory(): Promise<Array<SeoPageModel & { service: ClinicalService }>> {
  const rows: Array<SeoPageModel & { service: ClinicalService }> = [];
  const verticals = await listVerticalConfigs();
  for (const vertical of verticals) {
    const services = await getServicesForVertical(vertical);
    for (const service of services) {
      const model = await buildSeoPageModel({
        kind: "service",
        verticalSlug: vertical.slug,
        serviceSlug: service.seo_slug ?? service.code ?? service.id,
        includeDisabled: true,
      });
      if (model?.service) rows.push(model as SeoPageModel & { service: ClinicalService });
    }
  }
  return rows;
}

export async function getSeoServiceStats(vertical: VerticalConfig, service: ClinicalService, city = DEFAULT_CITY): Promise<SeoServiceStats> {
  if (service.service_kind === "lab_test") {
    try {
      const row = await getLabCompareRow(service, city);
      return statsFromLabRow(row);
    } catch {
      return emptyStats();
    }
  }

  return getGeneralServiceStats(vertical, service, city);
}

export function getServiceIndexability(
  vertical: VerticalConfig,
  service: ClinicalService,
  stats: SeoServiceStats,
): SeoIndexabilityStatus {
  if (!vertical.enabled || !service.is_active || isVerticalBlocked(vertical)) return "disabled";
  if (!service.seo_slug) return "duplicate_risk";
  if (stats.providers_count < ENOUGH_DATA_PROVIDERS || stats.offers_count < ENOUGH_DATA_OFFERS) {
    return "not_enough_data";
  }
  return "indexed_ready";
}

export function getDisclaimer(domain: VerticalDomain): string {
  if (domain === "veterinary") {
    return "LabPrice OS сравнивает только цены и доступность ветеринарных услуг. Это не ветеринарная рекомендация и не заменяет консультацию специалиста.";
  }
  return "LabPrice OS сравнивает только цены и доступность медицинских услуг. Это не медицинская рекомендация, не назначение анализов и не замена консультации врача.";
}

export function buildSeoPath(kind: SeoPageKind, verticalSlug: string, serviceSlug?: string, citySlug = "moscow"): string {
  if (kind === "vertical") return `/${verticalSlug}`;
  if (!serviceSlug) return `/${verticalSlug}`;
  if (kind === "city_service") return `/${citySlug}/${verticalSlug}/${serviceSlug}`;
  if (kind === "compare_service") return `/compare/${verticalSlug}/${serviceSlug}`;
  return `/${verticalSlug}/${serviceSlug}`;
}

export function formatRub(value: number | null | undefined): string {
  return value === null || value === undefined ? "н/д" : `${Math.round(value)} ₽`;
}

async function getLabCompareRow(service: ClinicalService, city: string): Promise<ProductCompareRow | undefined> {
  if (service.service_kind !== "lab_test") return undefined;
  const data = await getComparePageData({ test: service.name_ru, city });
  return data.rows[0];
}

async function getLabCompareRowSafe(service: ClinicalService, city: string): Promise<ProductCompareRow | undefined> {
  try {
    return await getLabCompareRow(service, city);
  } catch {
    return undefined;
  }
}

function statsFromLabRow(row: ProductCompareRow | undefined): SeoServiceStats {
  const summary = row?.market_summary ?? null;
  const offers = row?.offers ?? [];
  return {
    providers_count: new Set(offers.map((offer) => offer.provider.id)).size,
    offers_count: offers.length,
    min_price_rub: summary?.min_price_rub ?? null,
    max_price_rub: summary?.max_price_rub ?? null,
    median_price_rub: summary?.median_price_rub ?? null,
    cheapest_provider_name: summary?.cheapest.provider.name ?? row?.cheapest?.provider.name ?? null,
    cheapest_total_rub: summary?.cheapest.total_price_rub ?? row?.cheapest?.total_price_rub ?? null,
    nearby_providers: offers.slice(0, 5).map(providerFromLabOffer),
  };
}

async function getGeneralServiceStats(
  _vertical: VerticalConfig,
  service: ClinicalService,
  city: string,
): Promise<SeoServiceStats> {
  try {
    const supabase = createLabCrawlerSupabaseClient();
    const { data, error } = await supabase
      .from("service_prices")
      .select(`
        effective_price_rub,
        source_url,
        provider_services!inner(id, name, clinical_service_id, lab_providers(id, name, display_name)),
        provider_locations(name, address, city, source_url)
      `)
      .eq("provider_services.clinical_service_id", service.id)
      .eq("provider_locations.city", city)
      .order("effective_price_rub", { ascending: true })
      .limit(100);

    if (error) throw error;
    const rows = (data ?? []) as Array<{
      effective_price_rub?: number | string | null;
      source_url?: string | null;
      provider_services?: {
        name?: string | null;
        lab_providers?: { id?: string; name?: string; display_name?: string | null } | null;
      } | null;
      provider_locations?: { name?: string | null; address?: string | null; city?: string | null; source_url?: string | null } | null;
    }>;
    const prices = rows
      .map((row) => Number(row.effective_price_rub))
      .filter((value) => Number.isFinite(value));
    const providers = new Set(rows.map((row) => row.provider_services?.lab_providers?.id).filter(Boolean));
    const cheapest = rows.find((row) => Number.isFinite(Number(row.effective_price_rub)));

    return {
      providers_count: providers.size,
      offers_count: rows.length,
      min_price_rub: prices.length ? Math.min(...prices) : null,
      max_price_rub: prices.length ? Math.max(...prices) : null,
      median_price_rub: prices.length ? median(prices) : null,
      cheapest_provider_name: cheapest?.provider_services?.lab_providers?.display_name ?? cheapest?.provider_services?.lab_providers?.name ?? null,
      cheapest_total_rub: cheapest ? Number(cheapest.effective_price_rub) : null,
      nearby_providers: rows.slice(0, 5).map((row) => ({
        provider_name: row.provider_services?.lab_providers?.display_name ?? row.provider_services?.lab_providers?.name ?? "Провайдер",
        address: row.provider_locations?.address ?? undefined,
        source_url: row.provider_locations?.source_url ?? row.source_url ?? undefined,
      })),
    };
  } catch {
    return emptyStats();
  }
}

async function getServicesWithStats(vertical: VerticalConfig, services: ClinicalService[]): Promise<ClinicalService[]> {
  const ready: ClinicalService[] = [];
  for (const service of services) {
    const stats = await getSeoServiceStats(vertical, service);
    if (getServiceIndexability(vertical, service, stats) === "indexed_ready") ready.push(service);
  }
  return ready;
}

function providerFromLabOffer(offer: ProductOffer): SeoServiceStats["nearby_providers"][number] {
  return {
    provider_name: offer.provider.name,
    address: offer.nearest_location?.address,
    source_url: offer.source_url,
  };
}

function isVerticalBlocked(vertical: VerticalConfig): boolean {
  return vertical.domain === "veterinary" && !isVetVerticalEnabled();
}

function normalizeVertical(row: VerticalConfig): VerticalConfig {
  return {
    ...row,
    domain: row.domain === "veterinary" ? "veterinary" : "human",
    service_kinds: row.service_kinds as ServiceKind[],
  };
}

function normalizeService(row: ClinicalService): ClinicalService {
  return {
    ...row,
    domain: row.domain === "veterinary" ? "veterinary" : "human",
    aliases: row.aliases ?? [],
    seo_slug: row.seo_slug || slugify(row.name_ru),
  };
}

function renderTemplate(template: string, tokens: Record<string, string>): string {
  return Object.entries(tokens).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template,
  );
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function emptyStats(): SeoServiceStats {
  return {
    providers_count: 0,
    offers_count: 0,
    min_price_rub: null,
    max_price_rub: null,
    median_price_rub: null,
    cheapest_provider_name: null,
    cheapest_total_rub: null,
    nearby_providers: [],
  };
}

function verticalFallback(
  code: string,
  name: string,
  slug: string,
  domain: VerticalDomain,
  serviceKinds: ServiceKind[],
  enabled: boolean,
  priority: number,
  searchPlaceholder: string,
): VerticalConfig {
  return {
    id: code,
    code,
    name,
    slug,
    domain,
    service_kinds: serviceKinds,
    seo_title_template: "{service}: цены и сравнение в {city} | LabPrice OS",
    seo_description_template: "Сравнение цен и доступности для {service} в {city}: минимальная цена, медиана, диапазон и провайдеры.",
    search_placeholder: searchPlaceholder,
    enabled,
    priority,
  };
}
