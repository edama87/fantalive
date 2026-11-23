/**
 * Testo e versione del disclaimer obbligatorio all'ingresso.
 * Se il testo cambia, aggiornare DISCLAIMER_UPDATED_AT (o DISCLAIMER_VERSION)
 * così la chiave localStorage cambia e l'accettazione viene chiesta di nuovo.
 */

export const DISCLAIMER_VERSION = 'v1';
export const DISCLAIMER_UPDATED_AT = '2026-11-23';
export const DISCLAIMER_STORAGE_KEY = `fantalive_disclaimer_${DISCLAIMER_VERSION}_${DISCLAIMER_UPDATED_AT}`;
export const DISCLAIMER_PENDING_CLASS = 'disclaimer-pending';

export const DISCLAIMER_TITLE = 'Prima di entrare';

export const DISCLAIMER_PARAGRAPHS = [
  'FantaLive è un portale amatoriale, creato a solo scopo di gioco per i partecipanti della lega Bundlesliga.',
  'Non è un servizio ufficiale e i suoi contenuti non hanno valore ufficiale: classifiche, risultati e punteggi mostrati qui sono indicativi.',
  "I voti e i punteggi live possono contenere errori o essere incompleti finché non vengono importati da FMS Revo, che resta l'unica piattaforma ufficiale della lega. In caso di differenze, fa fede sempre FMS Revo.",
  'Commenti, articoli e vignette sono contenuti ironici e di fantasia.',
] as const;

/** Righe finali in corsivo, tono scherzoso. */
export const DISCLAIMER_ITALIC_LINES = [
  "Qualsiasi somiglianza tra questi voti e la realtà è puramente casuale, almeno fino all'import da FMS Revo.",
  'Ricorda comunque: il pianto paga, sempre.',
] as const;

export function isDisclaimerExemptPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

/** Script sincrono da mettere in <head>: copre la pagina prima del paint se manca l'accettazione. */
export function getDisclaimerBootScript(): string {
  const key = DISCLAIMER_STORAGE_KEY;
  const className = DISCLAIMER_PENDING_CLASS;
  return `(function(){try{var p=location.pathname;if(p==="/admin"||p.indexOf("/admin/")===0)return;if(!localStorage.getItem(${JSON.stringify(key)}))document.documentElement.classList.add(${JSON.stringify(className)});}catch(e){var p=location.pathname;if(p!=="/admin"&&p.indexOf("/admin/")!==0)document.documentElement.classList.add(${JSON.stringify(className)});}})();`;
}

const acceptanceListeners = new Set<() => void>();

export function subscribeDisclaimerAcceptance(onChange: () => void): () => void {
  acceptanceListeners.add(onChange);
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onChange);
  }
  return () => {
    acceptanceListeners.delete(onChange);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onChange);
    }
  };
}

export function hasAcceptedDisclaimer(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return Boolean(localStorage.getItem(DISCLAIMER_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function acceptDisclaimer(now = new Date()): void {
  localStorage.setItem(DISCLAIMER_STORAGE_KEY, now.toISOString());
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove(DISCLAIMER_PENDING_CLASS);
  }
  acceptanceListeners.forEach((listener) => listener());
}
