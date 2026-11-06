/**
 * Vereinfachte Körperkarte. Jede Form hat ein data-muscle-Attribut,
 * das mit den Muskel-IDs aus dem Übungskatalog übereinstimmt.
 * Wird über dynamischen Import geladen, damit der Start-Bundle klein bleibt.
 */

interface Region {
  muscle: string;
  shape: 'rect' | 'ellipse';
  x: number;
  y: number;
  w: number;
  h: number;
}

const FRONT: Region[] = [
  { muscle: 'schulter', shape: 'ellipse', x: 40, y: 62, w: 16, h: 14 },
  { muscle: 'schulter', shape: 'ellipse', x: 104, y: 62, w: 16, h: 14 },
  { muscle: 'brust', shape: 'rect', x: 56, y: 66, w: 48, h: 26 },
  { muscle: 'bizeps', shape: 'rect', x: 34, y: 80, w: 12, h: 30 },
  { muscle: 'bizeps', shape: 'rect', x: 114, y: 80, w: 12, h: 30 },
  { muscle: 'bauch', shape: 'rect', x: 60, y: 96, w: 40, h: 40 },
  { muscle: 'quadrizeps', shape: 'rect', x: 56, y: 146, w: 20, h: 56 },
  { muscle: 'quadrizeps', shape: 'rect', x: 84, y: 146, w: 20, h: 56 },
  { muscle: 'waden', shape: 'rect', x: 58, y: 208, w: 16, h: 44 },
  { muscle: 'waden', shape: 'rect', x: 86, y: 208, w: 16, h: 44 },
];

const BACK: Region[] = [
  { muscle: 'schulter', shape: 'ellipse', x: 40, y: 62, w: 16, h: 14 },
  { muscle: 'schulter', shape: 'ellipse', x: 104, y: 62, w: 16, h: 14 },
  { muscle: 'ruecken', shape: 'rect', x: 56, y: 66, w: 48, h: 60 },
  { muscle: 'trizeps', shape: 'rect', x: 34, y: 80, w: 12, h: 30 },
  { muscle: 'trizeps', shape: 'rect', x: 114, y: 80, w: 12, h: 30 },
  { muscle: 'gluteus', shape: 'rect', x: 56, y: 130, w: 48, h: 26 },
  { muscle: 'beinbeuger', shape: 'rect', x: 56, y: 160, w: 20, h: 42 },
  { muscle: 'beinbeuger', shape: 'rect', x: 84, y: 160, w: 20, h: 42 },
  { muscle: 'waden', shape: 'rect', x: 58, y: 208, w: 16, h: 44 },
  { muscle: 'waden', shape: 'rect', x: 86, y: 208, w: 16, h: 44 },
];

/** Zeichnet die Regionen; Intensität 0..1 steuert die Deckkraft. */
function Figure({ regions, intensity, title }: { regions: Region[]; intensity: Record<string, number>; title: string }) {
  return (
    <figure class="bodyfig">
      <svg viewBox="0 0 160 260" role="img" aria-label={title}>
        <circle cx="80" cy="30" r="20" class="silhouette" />
        <rect x="52" y="54" width="56" height="200" rx="18" class="silhouette" />
        {regions.map((r) => {
          const v = intensity[r.muscle] ?? 0;
          const common = {
            class: 'muscle',
            'data-muscle': r.muscle,
            'fill-opacity': v > 0 ? 0.25 + 0.75 * v : 0,
          };
          return r.shape === 'ellipse' ? (
            <ellipse cx={r.x + r.w / 2} cy={r.y + r.h / 2} rx={r.w / 2} ry={r.h / 2} {...common} />
          ) : (
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="4" {...common} />
          );
        })}
      </svg>
      <figcaption class="muted">{title}</figcaption>
    </figure>
  );
}

export function BodyMap({ intensity }: { intensity: Record<string, number> }) {
  return (
    <div class="bodymap">
      <Figure regions={FRONT} intensity={intensity} title="Vorderseite" />
      <Figure regions={BACK} intensity={intensity} title="Rückseite" />
    </div>
  );
}
