"use client";

import { useEffect, useState } from "react";
import type { GlobalBoard } from "@/lib/public-state";

export function NationalBoardLive({ initial, page, metric }: { initial: GlobalBoard; page: number; metric: string }) {
  const [board, setBoard] = useState(initial);

  useEffect(() => {
    setBoard(initial);
  }, [initial]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/leaderboard?page=${page}&metric=${metric}`, { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const next = (await response.json()) as GlobalBoard;
        if (!cancelled) setBoard(next);
      } catch {
        /* keep the server render */
      }
    };
    const kick = window.setTimeout(load, 800);
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearTimeout(kick);
      window.clearInterval(timer);
    };
  }, [page, metric]);

  return <BoardList board={board} />;
}

export function BoardList({ board }: { board: GlobalBoard }) {
  const score = (row: GlobalBoard["rows"][number]) =>
    board.metric === "absolute" ? row.absolute : row.euclidean.toFixed(2);
  const place = (row: GlobalBoard["rows"][number]) => (board.metric === "absolute" ? row.absoluteRank : row.rank);
  const inside = (row: GlobalBoard["rows"][number]) =>
    board.metric === "absolute" ? row.groupAbsoluteRank : row.groupRank;

  if (!board.scoreable) {
    return (
      <p className="mt-6 rounded-xl bg-card px-4 py-3 text-sm ring-1 ring-foreground/10">
        עדיין אין תוצאה שאפשר לדרג לפיה. הדירוג יופיע כשוועדת הבחירות תתחיל לפרסם, או כשמנהל האתר יזין תוצאה.
      </p>
    );
  }
  if (board.total === 0) {
    return (
      <p className="mt-6 rounded-xl bg-card px-4 py-3 text-sm ring-1 ring-foreground/10">
        עדיין אין ניחוש שלם שמופיע בדירוג הארצי.
      </p>
    );
  }

  const from = (board.page - 1) * board.pageSize + 1;
  const to = from + board.rows.length - 1;

  return (
    <div className="mt-4">
      <p className="text-sm text-muted-foreground">
        {from}–{to} מתוך {board.total}
      </p>
      <ol className="mt-3 divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {board.rows.map((row) => (
          <li key={`${row.groupCode}-${row.alias}-${row.rank}`} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-3 py-3">
            <span className="font-heading text-2xl tabular-nums text-primary">{place(row)}</span>
            <div className="min-w-0">
              <div className="truncate font-medium">{row.alias}</div>
              <a href={`/g/${row.groupCode}`} className="block truncate text-sm text-primary underline-offset-4 hover:underline">
                {row.groupName}
              </a>
              <div className="text-xs text-muted-foreground">מקום {inside(row)} בקבוצה</div>
            </div>
            <span className="tabular-nums">{score(row)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
