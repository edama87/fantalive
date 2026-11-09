import { z } from 'zod';

export const matchCommentPayloadSchema = z.object({
  round: z.number().int().positive().max(60),
  homeTeamId: z.string().trim().min(1).max(20),
  awayTeamId: z.string().trim().min(1).max(20),
  analysis: z.string().trim().min(1).max(8000),
  ironicNote: z.string().trim().min(1).max(500),
});

export type MatchCommentPayload = z.infer<typeof matchCommentPayloadSchema>;

export interface MatchComment {
  id: string | null;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  analysis: string;
  ironicNote: string;
  updatedAt: string | null;
  source: 'db' | 'seed';
}

export function analysisParagraphs(analysis: string): string[] {
  return analysis
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((block) => {
      if (block.includes('\n')) return [block];
      const parts = block
        .split(/(?<=\.)\s+(?=[A-ZÀÈÉÌÒÙ0-9«"])/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length <= 1) return [block];
      const chunks: string[] = [];
      let buf = '';
      for (const s of parts) {
        const next = buf ? `${buf} ${s}` : s;
        if (next.length > 220 && buf) {
          chunks.push(buf);
          buf = s;
        } else {
          buf = next;
        }
      }
      if (buf) chunks.push(buf);
      return chunks.length ? chunks : [block];
    });
}
