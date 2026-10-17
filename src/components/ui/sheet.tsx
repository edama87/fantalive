'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Finestra modale riutilizzabile basata su <dialog> nativo (focus, Esc e
 * aria-modal gestiti dal browser). Su telefono è un pannello dal basso, da
 * tablet in su una finestra centrata. Chiusura con X, Esc o tocco fuori.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onClose}
      onClick={(event) => {
        // tocco sullo sfondo (fuori dal pannello) = chiudi
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        'fixed m-0 p-0 w-full max-w-none bg-transparent backdrop:bg-gray-900/30',
        'inset-x-0 bottom-0 top-auto',
        'md:inset-0 md:m-auto md:max-w-md md:h-fit',
        className
      )}
    >
      <div
        className={cn(
          'bg-white shadow-xl border border-gray-100',
          'rounded-t-2xl max-h-[85vh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]',
          'md:rounded-2xl md:max-h-[80vh]'
        )}
      >
        <div className="sticky top-0 bg-white flex items-center justify-between gap-3 px-4 pt-3 pb-2 border-b border-gray-100">
          <div className="mx-auto absolute left-1/2 -translate-x-1/2 top-1.5 h-1 w-10 rounded-full bg-gray-200 md:hidden" aria-hidden />
          <h2 id={titleId} className="text-base font-semibold text-gray-900 pt-1">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Chiudi"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-4 pt-3 text-sm text-gray-700">{children}</div>
      </div>
    </dialog>
  );
}
