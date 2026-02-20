import { z } from "zod";
import { variationSchema } from "@artmint/common";

export const variationResponseSchema = z.object({
  variations: z.array(variationSchema).min(1).max(24),
});

export type VariationResponse = z.infer<typeof variationResponseSchema>;
