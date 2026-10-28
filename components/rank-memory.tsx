"use client";

import { useEffect, useState } from "react";

export function useRankMoves(storageKey: string, rows: { id: string; rank: number }[]) {
  const signature = rows.map((row) => `${row.id}:${row.rank}`).join("|");
  const [moves, setMoves] = useState<Record<string, number>>({});

  useEffect(() => {
    const current = signature
      ? signature.split("|").map((part) => {
          const split = part.lastIndexOf(":");
          return { id: part.slice(0, split), rank: Number(part.slice(split + 1)) };
        })
      : [];
    let previous: Record<string, number> = {};
    try {
      previous = JSON.parse(sessionStorage.getItem(storageKey) || "{}") as Record<string, number>;
    } catch {
      previous = {};
    }
    const nextMoves: Record<string, number> = {};
    const stored = { ...previous };
    for (const row of current) {
      if (!Number.isFinite(row.rank)) continue;
      if (typeof previous[row.id] === "number" && previous[row.id] !== row.rank) {
        nextMoves[row.id] = previous[row.id] - row.rank;
      }
      stored[row.id] = row.rank;
    }
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(stored));
    } catch {
      /* ignore quota */
    }
    setMoves(nextMoves);
  }, [storageKey, signature]);

  return moves;
}

export function RankMove({ delta }: { delta?: number }) {
  if (!delta) return null;
  const up = delta > 0;
  const steps = Math.abs(delta);
  return (
    <span className={`text-xs font-medium ${up ? "text-success" : "text-warning"}`}>
      {up ? `▲ ${steps}` : `▼ ${steps}`}
      <span className="sr-only">{up ? ` עלה ${steps} מקומות` : ` ירד ${steps} מקומות`}</span>
    </span>
  );
}
