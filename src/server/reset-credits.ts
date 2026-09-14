import { z } from "zod";

// OpenAI's backend-client/src/types.rs; these are ChatGPT subscription APIs.
export const resetCreditsSchema = z.object({
  available_count: z.number().int().nonnegative(),
  credits: z.array(
    z.object({
      id: z.string().min(1).max(500),
      reset_type: z.string(),
      status: z.string(),
      expires_at: z.string().datetime({ offset: true }).nullable(),
      title: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
    }),
  ),
});
export const resetResultSchema = z.object({
  code: z.enum(["reset", "already_redeemed", "nothing_to_reset", "no_credit"]),
});
