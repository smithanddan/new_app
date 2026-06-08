import type { ParsedLabItem } from '@labmind/shared';

export type ParseInput = {
  storagePath: string;
  mimeType: string;
  originalFilename?: string;
};

export type ParseOutput = {
  providerHint?: string;
  takenAt?: string;
  confidence: number;
  rawText: string;
  items: ParsedLabItem[];
};

export async function parseDocument(input: ParseInput): Promise<ParseOutput> {
  // TODO: Call MarkItDown first. If quality is low, route to OCR fallback.
  // Keep this interface stable so Edge Functions and workers can swap implementations.
  return {
    confidence: 0,
    rawText: `TODO parse ${input.originalFilename ?? input.storagePath}`,
    items: [],
  };
}
