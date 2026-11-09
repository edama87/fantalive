import { describe, expect, it } from 'vitest';
import { analysisParagraphs, matchCommentPayloadSchema } from '@/lib/match-comments-shared';
import {
  articleParagraphs,
  normalizeParagraphImages,
  roundArticlePayloadSchema,
  MASTHEAD_NAME,
} from '@/lib/round-articles-shared';
import { readFileSync } from 'node:fs';

describe('match comments', () => {
  it('splits analysis into readable paragraphs', () => {
    const text =
      'Prima frase lunga abbastanza. Seconda frase che continua il discorso. Terza ancora.';
    const parts = analysisParagraphs(text);
    expect(parts.length).toBeGreaterThanOrEqual(1);
    expect(parts.join(' ')).toContain('Prima frase');
  });

  it('validates payload', () => {
    const parsed = matchCommentPayloadSchema.safeParse({
      round: 5,
      homeTeamId: 'ym',
      awayTeamId: 'ap',
      analysis: 'Test analisi.',
      ironicNote: 'Chiusura.',
    });
    expect(parsed.success).toBe(true);
  });

  it('seed file has 5 comments and article', () => {
    const raw = JSON.parse(readFileSync('data/match-comments-g5.json', 'utf8'));
    expect(raw.comments).toHaveLength(5);
    expect(raw.article.round).toBe(5);
    expect(raw.article.headline.length).toBeGreaterThan(20);
    expect(raw.article.body.split(/\s+/).length).toBeGreaterThan(300);
    expect(raw.masthead).toBe(MASTHEAD_NAME);
  });
});

describe('round articles', () => {
  it('splits body on blank lines', () => {
    expect(articleParagraphs('Uno.\n\nDue.')).toEqual(['Uno.', 'Due.']);
  });

  it('validates article payload', () => {
    const parsed = roundArticlePayloadSchema.safeParse({
      round: 5,
      headline: 'Titolo',
      subtitle: null,
      body: 'Corpo articolo.',
    });
    expect(parsed.success).toBe(true);
  });

  it('normalizes plain URL strings and description fields', () => {
    expect(normalizeParagraphImages(['/giornale/5/a.webp', '/giornale/5/b.webp'])).toEqual([
      { paragraphIndex: 0, url: '/giornale/5/a.webp', alt: '', description: '' },
      { paragraphIndex: 1, url: '/giornale/5/b.webp', alt: '', description: '' },
    ]);
    expect(
      normalizeParagraphImages([
        { paragraph_index: 2, url: '/x.webp', description: 'Scena' },
      ]),
    ).toEqual([{ paragraphIndex: 2, url: '/x.webp', alt: '', description: 'Scena' }]);
  });
});

describe('giornale vignette seed', () => {
  it('maps paragraphs 0-4 with descriptions and no header image', () => {
    const raw = JSON.parse(readFileSync('data/match-comments-g5.json', 'utf8'));
    const imgs = raw.article.paragraphImages;
    expect(raw.article.headerImageUrl).toBeNull();
    expect(imgs.map((x: { paragraphIndex: number }) => x.paragraphIndex)).toEqual([0, 1, 2, 3, 4]);
    for (const img of imgs) {
      expect(img.description.length).toBeGreaterThan(20);
      expect(img.url).toMatch(/\/giornale\/5\/.+\.webp$/);
    }
    const paras = raw.article.body.split(/\n\s*\n/).map((p: string) => p.trim()).filter(Boolean);
    expect(paras.length).toBe(6);
  });
});
