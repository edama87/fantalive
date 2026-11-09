import { z } from 'zod';

export const MASTHEAD_NAME = 'Il Bundle Quotidiano';

export const roundArticlePayloadSchema = z.object({
  round: z.number().int().positive().max(60),
  headline: z.string().trim().min(1).max(300),
  subtitle: z.string().trim().max(500).nullable().optional(),
  body: z.string().trim().min(1).max(20000),
});

export type RoundArticlePayload = z.infer<typeof roundArticlePayloadSchema>;

export interface RoundArticle {
  id: string | null;
  round: number;
  headline: string;
  subtitle: string | null;
  body: string;
  updatedAt: string | null;
  source: 'db' | 'seed';
}

export function articleParagraphs(body: string): string[] {
  const blocks = body
    .split(/\n\s*\n/)
    .map((p) => p.trim().replace(/\s*\n\s*/g, ' '))
    .filter(Boolean);
  return blocks.length ? blocks : [body.trim()].filter(Boolean);
}
