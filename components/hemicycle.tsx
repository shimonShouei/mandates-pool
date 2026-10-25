const ROWS = [16, 20, 24, 28, 32];

export function Hemicycle({
  seats,
  total = 120,
}: {
  seats: { color: string; count: number }[];
  total?: number;
}) {
  const colors: string[] = [];
  for (const seat of seats) {
    const count = Math.max(0, Math.floor(seat.count));
    for (let index = 0; index < count && colors.length < total; index += 1) colors.push(seat.color);
  }
  const dots: { x: number; y: number; color: string | null }[] = [];
  let cursor = 0;
  const cx = 160;
  const cy = 168;
  ROWS.forEach((count, row) => {
    const radius = 48 + row * 24;
    for (let index = 0; index < count; index += 1) {
      const t = count === 1 ? 0.5 : index / (count - 1);
      const angle = Math.PI - t * Math.PI;
      dots.push({
        x: cx + radius * Math.cos(angle),
        y: cy - radius * Math.sin(angle),
        color: colors[cursor] ?? null,
      });
      cursor += 1;
    }
  });
  const filled = colors.length;

  return (
    <figure className="rounded-3xl bg-card p-3 ring-1 ring-border">
      <figcaption className="sr-only">
        תרשים חצי עיגול של הכנסת: {filled} מושבים צבועים מתוך {total}.
      </figcaption>
      <svg viewBox="0 0 320 188" className="h-auto w-full" aria-hidden="true">
        {dots.map((dot, index) => (
          <circle
            key={index}
            cx={dot.x}
            cy={dot.y}
            r={dot.color ? 5.2 : 4.2}
            fill={dot.color ?? "var(--muted)"}
            opacity={dot.color ? 1 : 0.9}
          />
        ))}
      </svg>
      <p className="text-center text-xs text-muted-foreground">כל נקודה היא מושב. הצבע הוא הרשימה שניחשתם.</p>
    </figure>
  );
}
