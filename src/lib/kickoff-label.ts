const WEEKDAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

/** "2026-10-27T18:30" (ora di Roma) -> "mar 27/10 · 18:30". */
export function kickoffLabel(local: string | undefined): string | null {
  const m = local ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(local) : null;
  if (!m) return null;
  const weekday = WEEKDAYS[new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()];
  return `${weekday} ${m[3]}/${m[2]} · ${m[4]}`;
}
