import Link from "next/link";
import { PlayerMark } from "@/components/player-mark";

export type PodiumEntry = {
  id: string;
  rank: number;
  title: string;
  subtitle?: string;
  href?: string;
  score: string;
  scoreLabel: string;
};

const MEDALS = ["🥇", "🥈", "🥉"];

export function Podium({ entries }: { entries: PodiumEntry[] }) {
  const ordered = [...entries].sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title, "he")).slice(0, 3);
  if (ordered.length === 0) return null;
  const first = ordered.find((entry) => entry.rank === ordered[0]?.rank) ?? ordered[0];
  const rest = ordered.filter((entry) => entry !== first);
  const second = rest[0];
  const third = rest[1];
  const slots = [second, first, third];

  return (
    <div className="grid grid-cols-3 items-end gap-2">
      {slots.map((entry, index) =>
        entry ? (
          <PodiumSlot key={entry.id} entry={entry} tall={index === 1} />
        ) : (
          <div key={`empty-${index}`} />
        ),
      )}
    </div>
  );
}

function PodiumSlot({ entry, tall }: { entry: PodiumEntry; tall: boolean }) {
  const medal = MEDALS[Math.min(2, Math.max(0, entry.rank - 1))] ?? "🏅";
  const body = (
    <div
      className={`flex h-full flex-col items-center rounded-3xl bg-card px-2 py-3 text-center ring-1 ring-border transition hover:-translate-y-0.5 hover:ring-primary/50 ${
        tall ? "min-h-40 bg-primary/10" : "min-h-32"
      }`}
    >
      <span className="text-2xl" aria-hidden="true">
        {medal}
      </span>
      <PlayerMark seed={entry.id} />
      <p className="mt-2 line-clamp-2 text-sm font-medium">{entry.title}</p>
      {entry.subtitle ? <p className="line-clamp-1 text-xs text-muted-foreground">{entry.subtitle}</p> : null}
      <p className="mt-auto pt-2 font-heading text-2xl tabular-nums leading-none">{entry.score}</p>
      <p className="text-[11px] text-muted-foreground">{entry.scoreLabel}</p>
    </div>
  );
  if (!entry.href) return body;
  return (
    <Link href={entry.href} className="block rounded-3xl focus-visible:ring-3 focus-visible:ring-ring">
      {body}
    </Link>
  );
}
