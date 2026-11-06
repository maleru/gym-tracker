export interface ChartPoint {
  label: string;
  y: number;
}

const W = 320;
const H = 200;
const PAD = 28;

const fmt = (v: number): string => (Math.round(v * 10) / 10).toString().replace('.', ',');

/** Leichtgewichtiges SVG-Liniendiagramm ohne externe Bibliothek. */
export function LineChart({ points }: { points: ChartPoint[] }) {
  if (points.length === 0) return <p class="muted">Noch keine Daten für diese Auswahl.</p>;

  const ys = points.map((p) => p.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const last = points.length - 1;
  const maxIdx = ys.indexOf(max);

  const xAt = (i: number): number => (points.length === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / last);
  const yAt = (v: number): number => H - PAD - ((v - min) / span) * (H - 2 * PAD);

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(p.y).toFixed(1)}`).join(' ');

  // Nur erster, letzter und höchster Wert werden beschriftet, sonst überlagern sich die Zahlen
  const labelled = new Set([0, last, maxIdx]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} class="chart" role="img" aria-label="Verlaufsdiagramm">
      <text x={2} y={yAt(max) + 4} class="lbl">
        {fmt(max)}
      </text>
      <text x={2} y={yAt(min) + 4} class="lbl">
        {fmt(min)}
      </text>
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} class="axis" />
      <path d={path} class="line" />
      {points.map((p, i) => (
        <g>
          <circle cx={xAt(i)} cy={yAt(p.y)} r="3.5" class="dot" />
          {labelled.has(i) && (
            <text x={xAt(i)} y={yAt(p.y) - 8} class="val">
              {fmt(p.y)}
            </text>
          )}
          {labelled.has(i) && (
            <text x={xAt(i)} y={H - 8} class="lbl">
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
