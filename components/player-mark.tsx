const MARKS = ["🦊", "🦉", "🐻", "🐸", "🦁", "🐼", "🦄", "🐙", "🐯", "🐨", "🐧", "🦋", "🐝", "🐬"];

export function markFor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33 + seed.charCodeAt(index)) >>> 0;
  }
  return MARKS[hash % MARKS.length] ?? "🦊";
}

export function PlayerMark({ seed, label }: { seed: string; label?: string }) {
  return (
    <span
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-lg ring-1 ring-border"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {markFor(seed)}
    </span>
  );
}
