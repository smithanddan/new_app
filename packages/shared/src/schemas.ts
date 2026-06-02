import { z } from "zod";

export const SourceKindSchema = z.enum(["products", "labs", "services", "competitors", "custom"]);

export const OfferSchema = z.object({
  title: z.string(),
  priceAmount: z.number().nullable(),
  currency: z.string().nullable(),
  availability: z.string().nullable(),
  sourceUrl: z.string().url().nullable()
});

export type Offer = z.infer<typeof OfferSchema>;
