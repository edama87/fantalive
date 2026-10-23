/**
 * Markdown minimale e sicuro (niente HTML grezzo): titoli, elenchi, paragrafi,
 * **grassetto**, *corsivo*, `codice` e link http(s).
 */
import type { ReactNode } from 'react';

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith('**')) out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('`')) out.push(<code key={key} className="rounded bg-gray-100 px-1 text-[0.9em]">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith('[')) {
      const [, label, href] = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
      out.push(<a key={key} href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline">{label}</a>);
    } else out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index! + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function SimpleMarkdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push(<p key={`p${blocks.length}`}>{inline(para.join(' '), `p${blocks.length}`)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const k = `l${blocks.length}`;
    const items = list.items.map((t, j) => <li key={j}>{inline(t, `${k}-${j}`)}</li>);
    blocks.push(list.ordered
      ? <ol key={k} className="list-decimal pl-5 space-y-1">{items}</ol>
      : <ul key={k} className="list-disc pl-5 space-y-1">{items}</ul>);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (!line) { flushPara(); flushList(); continue; }
    if (heading) {
      flushPara(); flushList();
      blocks.push(<h4 key={`h${blocks.length}`} className="font-semibold text-gray-900">{inline(heading[2], `h${blocks.length}`)}</h4>);
    } else if (bullet || numbered) {
      flushPara();
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara(); flushList();
  return <div className="space-y-2 text-sm leading-relaxed text-gray-700">{blocks}</div>;
}
