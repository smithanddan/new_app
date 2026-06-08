export type RawLabTest = {
  providerCode: string;
  externalTestId?: string;
  name: string;
  url: string;
};

export type NormalizedLabTest = {
  providerCode: string;
  externalTestId?: string;
  name: string;
  code?: string;
  price?: number;
  currency?: 'RUB';
  city?: string;
  biomaterial?: string;
  preparation?: string;
  turnaroundTime?: string;
  sourceUrl: string;
  checkedAt: string;
};

export interface LabCrawlerAdapter {
  providerCode: string;
  searchTests(query: string, city?: string): Promise<RawLabTest[]>;
  getTestDetails(url: string): Promise<unknown>;
  normalize(raw: unknown): Promise<NormalizedLabTest>;
}
