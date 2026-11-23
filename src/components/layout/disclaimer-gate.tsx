'use client';

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DISCLAIMER_ITALIC_LINES,
  DISCLAIMER_PARAGRAPHS,
  DISCLAIMER_TITLE,
  acceptDisclaimer,
  hasAcceptedDisclaimer,
  isDisclaimerExemptPath,
  subscribeDisclaimerAcceptance,
} from '@/lib/disclaimer';

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ),
  );
}

export function DisclaimerGate() {
  const pathname = usePathname() ?? '/';
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [checked, setChecked] = useState(false);
  const alreadyAccepted = useSyncExternalStore(
    subscribeDisclaimerAcceptance,
    () => isDisclaimerExemptPath(pathname) || hasAcceptedDisclaimer(),
    () => true,
  );

  useEffect(() => {
    if (alreadyAccepted) return;
    const root = dialogRef.current;
    const previously = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const items = root ? focusableElements(root) : [];
    items[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== 'Tab' || !root) return;
      const focusable = focusableElements(root);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previously?.focus();
    };
  }, [alreadyAccepted]);

  const onEnter = useCallback(() => {
    if (!checked) return;
    acceptDisclaimer();
  }, [checked]);

  if (alreadyAccepted) return null;

  return (
    <div
      data-disclaimer-root
      className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center"
    >
      <div className="absolute inset-0 bg-gray-900/50" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="relative z-[1] flex max-h-[min(90vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div id={bodyId} className="flex-1 overflow-y-auto px-5 pt-5 pb-2 sm:px-6 sm:pt-6">
          <h1 id={titleId} className="text-lg font-semibold text-gray-900 sm:text-xl">
            {DISCLAIMER_TITLE}
          </h1>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-gray-600 sm:text-base">
            {DISCLAIMER_PARAGRAPHS.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <div className="space-y-2 pt-1">
              {DISCLAIMER_ITALIC_LINES.map((line) => (
                <p key={line} className="italic text-gray-500">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
        <form
          className="border-t border-gray-100 px-5 py-4 sm:px-6"
          onSubmit={(event) => {
            event.preventDefault();
            onEnter();
          }}
        >
          <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
            />
            <span>Ho letto e accetto</span>
          </label>
          <Button type="submit" className="mt-4 w-full" disabled={!checked}>
            Entra
          </Button>
        </form>
      </div>
    </div>
  );
}
