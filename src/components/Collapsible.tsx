import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

interface Props {
  /** Titel der Kopfzeile */
  header: ComponentChildren;
  /** Zusatzinfo unter dem Titel, bleibt auch im zugeklappten Zustand sichtbar */
  summary?: ComponentChildren;
  /** Steuerung von außen (kontrolliert). Ohne Angabe verwaltet die Komponente den Zustand selbst. */
  open?: boolean;
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
  children?: ComponentChildren;
  class?: string;
  /** Zusatz-Aktionen (z. B. Zahnrad), liegen neben dem Kopf und nicht darin */
  actions?: ComponentChildren;
}

/**
 * Einklappbarer Bereich. Die gesamte Kopfzeile ist eine Schaltfläche,
 * damit die Klickfläche groß genug für Touch-Bedienung bleibt.
 */
export function Collapsible({
  header,
  summary,
  open: controlled,
  defaultOpen = false,
  onToggle,
  children,
  class: cls,
  actions,
}: Props) {
  const [inner, setInner] = useState(defaultOpen);
  const open = controlled ?? inner;

  const toggle = () => {
    const next = !open;
    if (controlled === undefined) setInner(next);
    onToggle?.(next);
  };

  return (
    <div class={`collapsible${open ? ' open' : ''}${cls ? ` ${cls}` : ''}`}>
      <div class="collapsible-bar">
        <button type="button" class="collapsible-head" aria-expanded={open} onClick={toggle}>
          <span class="collapsible-title">
            <span>{header}</span>
            {summary && <span class="collapsible-summary">{summary}</span>}
          </span>
          <span class="collapsible-chev" aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
        </button>
        {actions}
      </div>
      {open && <div class="collapsible-body">{children}</div>}
    </div>
  );
}
