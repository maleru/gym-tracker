import { useEffect, useState } from 'preact/hooks';

const fmt = (v: number): string => String(v).replace('.', ',');

/** Liest "6,25" oder "6.25"; unvollständige Eingaben wie "6," ergeben 6. */
const parse = (raw: string): number | undefined => {
  const t = raw.trim().replace(',', '.');
  if (t === '' || t === '.') return undefined;
  const n = Number(t);
  return Number.isNaN(n) ? undefined : n;
};

interface Props {
  value: number;
  onChange: (v: number) => void;
  class?: string;
}

/**
 * Dezimalfeld, das das Komma beim Tippen behält.
 * Der Text bleibt lokal, nur gültige Zahlen werden weitergegeben.
 */
export function DecimalInput({ value, onChange, class: cls }: Props) {
  const [text, setText] = useState(fmt(value));

  // Von außen geänderte Werte (z. B. Stepper-Buttons) übernehmen
  useEffect(() => {
    if (parse(text) !== value) setText(fmt(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      class={cls}
      value={text}
      onInput={(e) => {
        const raw = e.currentTarget.value;
        setText(raw);
        const n = parse(raw);
        if (n !== undefined) onChange(n);
      }}
    />
  );
}
