"use client";

import { useEffect, useState } from "react";
import { PlayerMark } from "@/components/player-mark";
import { Podium } from "@/components/podium";
import { RankMove, useRankMoves } from "@/components/rank-memory";
import { formatNumber, formatScore } from "@/lib/format";
import type { GlobalBoard } from "@/lib/public-state";

export function NationalBoardLive({ initial, page }: { initial: GlobalBoard; page: number }) {
  const [board, setBoard] = useState(initial);

  useEffect(() => {
    setBoard(initial);
  }, [initial]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/leaderboard?page=${page}`);
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
  }, [page]);

  return <BoardList board={board} />;
}

export function BoardList({ board }: { board: GlobalBoard }) {
  if (!board.scoreable) {
    return (
      <p className="mt-6 rounded-3xl bg-card px-4 py-6 text-sm ring-1 ring-border">
        <span className="mb-2 block text-3xl" aria-hidden="true">
          🗳️
        </span>
        עדיין אין תוצאה שאפשר לדרג לפיה. הדירוג יופיע כשוועדת הבחירות תתחיל לפרסם, או כשמנהל האתר יזין תוצאה.
      </p>
    );
  }
  if (board.total === 0) {
    return (
      <p className="mt-6 rounded-3xl bg-card px-4 py-6 text-sm ring-1 ring-border">
        <span className="mb-2 block text-3xl" aria-hidden="true">
          🏁
        </span>
        עדיין אין ניחוש שלם שמופיע בדירוג הארצי.
      </p>
    );
  }

  return <RankedNational board={board} />;
}

function RankedNational({ board }: { board: GlobalBoard }) {
  const from = (board.page - 1) * board.pageSize + 1;
  const to = from + board.rows.length - 1;
  const bonusOn = board.thresholdBonus > 0;
  const moves = useRankMoves(
    "mandatim-national-ranks",
    board.rows.map((row) => ({ id: `${row.groupCode}:${row.alias}`, rank: row.rank })),
  );
  const podium =
    board.page === 1
      ? board.rows
          .filter((row) => row.rank <= 3)
          .slice(0, 3)
          .map((row) => ({
            id: `${row.groupCode}:${row.alias}`,
            rank: row.rank,
            title: row.alias,
            subtitle: row.groupName,
            href: `/g/${row.groupCode}`,
            score: formatScore(row.misplaced),
            scoreLabel: "לא במקום",
          }))
      : [];

  return (
    <div className="mt-4 space-y-4">
      {podium.length > 0 ? <Podium entries={podium} /> : null}
      <p className="text-sm text-muted-foreground">
        {from}–{to} מתוך {board.total}
      </p>
      <ol className="space-y-2">
        {board.rows.map((row) => {
          const id = `${row.groupCode}:${row.alias}`;
          return (
            <li key={id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-3xl bg-card px-3 py-3 ring-1 ring-border">
              <span className="flex items-center gap-2">
                <span className="w-8 font-heading text-2xl tabular-nums text-primary">{formatNumber(row.rank)}</span>
                <PlayerMark seed={id} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{row.alias}</span>
                  <RankMove delta={moves[id]} />
                </div>
                <a href={`/g/${row.groupCode}`} className="block truncate text-sm text-primary underline-offset-4 hover:underline">
                  {row.groupName}
                </a>
                <div className="text-xs text-muted-foreground">מקום {formatNumber(row.groupRank)} בקבוצה</div>
              </div>
              <div className="text-end text-sm tabular-nums">
                <div className="font-medium">{formatScore(row.misplaced)}</div>
                <div className="text-xs text-muted-foreground">סטיות {formatNumber(row.absolute)}</div>
                {bonusOn ? (
                  <div className="text-xs text-muted-foreground">
                    חסימה {formatNumber(row.thresholdCorrect)}/{formatNumber(board.partyCount)}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
