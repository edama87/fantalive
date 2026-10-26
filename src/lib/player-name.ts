/** "BERNARDESCHI Federico" -> "Bernardeschi"; "N'DRI Konan" -> "N'Dri"; "LAURIENTE'" -> "Laurienté". */
export function shortName(name: string) {
  const surname = name.split(' ').filter((w) => w === w.toUpperCase() && /[A-Z]/.test(w)).join(' ') || name;
  const ACCENT: Record<string, string> = { a: 'à', e: 'é', i: 'ì', o: 'ò', u: 'ù' };
  return surname
    .toLowerCase()
    .replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase())
    .replace(/\bMc(\p{L})/gu, (_, c: string) => `Mc${c.toUpperCase()}`)
    .replace(/([aeiou])'(?=\s|$)/g, (_, v: string) => ACCENT[v]);
}
