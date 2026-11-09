import { z } from 'zod';

export const MASTHEAD_NAME = 'Il Bundle Quotidiano';

export const paragraphImageSchema = z.object({
  paragraphIndex: z.number().int().min(0).max(40),
  url: z.string().trim().min(1).max(500),
  alt: z.string().trim().max(300).optional().default(''),
  description: z.string().trim().max(800).optional().default(''),
});

export type ParagraphImage = z.infer<typeof paragraphImageSchema>;

export const roundArticlePayloadSchema = z.object({
  round: z.number().int().positive().max(60),
  headline: z.string().trim().min(1).max(300),
  subtitle: z.string().trim().max(500).nullable().optional(),
  body: z.string().trim().min(1).max(20000),
  /** Legacy: non più mostrata in UI; accettata in scrittura per svuotarla. */
  headerImageUrl: z.string().trim().max(500).nullable().optional(),
  paragraphImages: z.array(paragraphImageSchema).max(40).optional(),
});

export type RoundArticlePayload = z.infer<typeof roundArticlePayloadSchema>;

export interface RoundArticle {
  id: string | null;
  round: number;
  headline: string;
  subtitle: string | null;
  body: string;
  headerImageUrl: string | null;
  paragraphImages: ParagraphImage[];
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

export function paragraphImageMap(images: ParagraphImage[]): Map<number, ParagraphImage> {
  return new Map(images.map((img) => [img.paragraphIndex, img]));
}

/**
 * Accetta array di oggetti {paragraphIndex?, url, alt?, description?}
 * oppure stringhe URL (indice = posizione nell'array).
 */
export function normalizeParagraphImages(raw: unknown): ParagraphImage[] {
  if (!Array.isArray(raw)) return [];
  const out: ParagraphImage[] = [];
  raw.forEach((item, arrayIndex) => {
    if (typeof item === 'string') {
      const url = item.trim();
      if (!url) return;
      out.push({ paragraphIndex: arrayIndex, url, alt: '', description: '' });
      return;
    }
    if (!item || typeof item !== 'object') return;
    const rec = item as Record<string, unknown>;
    const paragraphIndex =
      typeof rec.paragraphIndex === 'number'
        ? rec.paragraphIndex
        : typeof rec.paragraph_index === 'number'
          ? rec.paragraph_index
          : arrayIndex;
    const url = typeof rec.url === 'string' ? rec.url.trim() : '';
    if (!url) return;
    const alt = typeof rec.alt === 'string' ? rec.alt.trim() : '';
    const description =
      typeof rec.description === 'string'
        ? rec.description.trim()
        : typeof rec.descrizione === 'string'
          ? rec.descrizione.trim()
          : '';
    out.push({ paragraphIndex, url, alt, description });
  });
  return out.sort((a, b) => a.paragraphIndex - b.paragraphIndex);
}
