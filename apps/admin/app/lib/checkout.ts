export type CheckoutLinkInput = {
  providerCode?: string;
  testName?: string;
  canonicalTestId?: string;
  providerTestId?: string;
  targetUrl?: string;
  sourceUrl?: string;
  city?: string;
  utmSource?: string;
  utmCampaign?: string;
};

export function buildCheckoutHref(input: CheckoutLinkInput): string {
  const params = new URLSearchParams();
  appendParam(params, "provider", input.providerCode);
  appendParam(params, "test", input.testName);
  appendParam(params, "canonical_test_id", input.canonicalTestId);
  appendParam(params, "provider_test_id", input.providerTestId);
  appendParam(params, "target", input.targetUrl);
  appendParam(params, "source", input.sourceUrl);
  appendParam(params, "city", input.city);
  appendParam(params, "utm_source", input.utmSource);
  appendParam(params, "utm_campaign", input.utmCampaign);

  return `/checkout?${params.toString()}`;
}

function appendParam(params: URLSearchParams, key: string, value: string | undefined) {
  if (value) {
    params.set(key, value);
  }
}
