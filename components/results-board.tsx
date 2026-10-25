"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatIls, formatNumber, formatPercent, formatScore, formatSigned, formatWhen } from "@/lib/format";
import { splitLabel, STAKE_NOTE } from "@/lib/payout";
import type { GroupStanding, OwnView, PublicGroupState, PublicStandingsPayload } from "@/lib/public-state";

const METHOD: Record<string, string> = {
  "bader-ofer": "חלוקה: באדר-עופר לפי הקולות",
  "official-mandates": "חלוקה: המנדטים שפרסמה ועדת הבחירות",
  manual: "חלוקה: הזנה ידנית",
  incomplete: "עדיין אין 120 מנדטים",
};

export function ResultsBoard({ code, initial }: { code: string; initial: PublicGroupState }) {
  const [state, setState] = useState(initial);
  const fetchedAt = useRef(initial.results?.fetchedAt ?? null);

  useEffect(() => {
    setState(initial);
    fetchedAt.current = initial.results?.fetchedAt ?? null;
  }, [initial]);

  useEffect(() => {
    let cancelled = false;
    const loadOwn = async () => {
      try {
        const response = await fetch(`/api/groups/${code}/me`, { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as { own: OwnView | null };
        if (cancelled) return;
        setState((current) => applyOwn(current, payload.own));
      } catch {
        /* keep the last private view */
      }
    };
    const load = async () => {
      try {
        const response = await fetch(`/api/groups/${code}/standings`);
        if (!response.ok || cancelled) return;
        const next = (await response.json()) as PublicStandingsPayload;
        if (cancelled) return;
        const previousAt = fetchedAt.current;
        const nextAt = next.results?.fetchedAt ?? null;
        fetchedAt.current = nextAt;
        setState((current) => mergePublic(current, next));
        if (nextAt !== previousAt) await loadOwn();
      } catch {
        /* keep the last board */
      }
    };
    const timer = window.setInterval(load, 60_000);
    const kick = window.setTimeout(load, 400);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(kick);
    };
  }, [code]);

  const results = state.results;
  const standings = [...state.standings].sort((a, b) => a.rank - b.rank || a.alias.localeCompare(b.alias, "he"));
  const winners = standings.filter((row) => row.rank === 1);
  const bonusOn = state.thresholdBonus > 0;

  return (
    <section className="mt-8 space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-heading text-3xl">הדירוג</h2>
        <p className="text-sm text-muted-foreground">
          {state.completeCount} ניחושים שלמים · {state.participantCount} במשחק
        </p>
      </div>

      {state.fetchProblem ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950 ring-1 ring-amber-200">{state.fetchProblem}</p>
      ) : null}

      {results ? (
        <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={results.status === "final" ? "secondary" : "outline"}>
              {results.status === "final" ? "תוצאות סופיות" : "תוצאות ארעיות"}
            </Badge>
            <span className="text-sm text-muted-foreground">{sourceLabel(results.source)}</span>
          </div>
          <p className="text-sm">
            {results.countedPercent != null && results.status === "provisional"
              ? `נספרו ${formatPercent(results.countedPercent)} מהקולות. `
              : results.status === "final"
                ? "הספירה הסתיימה. "
                : "אחוז הכיסוי לא פורסם במקור. "}
            {results.turnoutPercent != null ? `שיעור הצבעה ${formatPercent(results.turnoutPercent)}. ` : ""}
            עודכן {formatWhen(results.fetchedAt)}.
          </p>
          <p className="text-sm text-muted-foreground">{METHOD[results.seatMethod]}</p>
          {results.note ? <p className="whitespace-pre-wrap text-sm text-amber-950">{results.note}</p> : null}
          {results.unmapped.some((row) => row.seats > 0) ? (
            <ul className="text-sm text-amber-950">
              {results.unmapped
                .filter((row) => row.seats > 0)
                .map((row) => (
                  <li key={`${row.ballot}-${row.name}`}>
                    {row.name} ({row.ballot || "בלי אות"}) קיבלה {formatNumber(row.seats)} מנדטים ואין לה שורה בניחוש.
                  </li>
                ))}
            </ul>
          ) : null}
          {results.scoreable ? (
            <ul className="divide-y divide-border">
              {results.parties
                .filter((party) => party.seats > 0 || (party.votes ?? 0) > 0)
                .map((party) => (
                  <li key={party.name} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: party.color }} />
                      <span className="truncate">{party.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-medium">{formatNumber(party.seats)}</span>
                      {party.votes != null ? (
                        <span className="text-muted-foreground"> · {formatNumber(party.votes)}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm">הדירוג יופיע כשתושלם חלוקה של 120 מנדטים.</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          הדירוג יופיע ברגע שתתפרסם חלוקת מנדטים. עד אז אף אחד לא רואה את הניחוש של האחרים, וגם אחר כך רואים רק כינוי וציון.
        </p>
      )}

      {state.stake ? (
        <div className="space-y-1 rounded-xl bg-card px-4 py-3 text-sm ring-1 ring-foreground/10">
          <p>
            קופה {formatIls(state.stake.potAgorot)} · {formatIls(state.stake.buyInAgorot)} למשתתף · {splitLabel(state.stake.split)}
          </p>
          <p className="text-muted-foreground">{STAKE_NOTE}</p>
        </div>
      ) : null}

      {results?.scoreable && standings.length > 0 ? (
        <div className="space-y-3">
          <p className="font-heading text-2xl">
            {winners.length === 1
              ? winners[0].isYou
                ? "הכי מעט מושבים לא במקום: אתם"
                : `הכי מעט מושבים לא במקום: ${winners[0].alias}`
              : `תיקו בצמרת: ${winners.map((row) => row.alias).join(", ")}`}
          </p>
          <p className="text-xs text-muted-foreground">
            המספר הגדול הוא מושבים לא במקום, חצי מסכום הסטיות. נמוך יותר עדיף.{" "}
            <Link href="/scoring" className="text-primary underline-offset-4 hover:underline">
              איך מחשבים את הציון
            </Link>
          </p>
          <ol className="space-y-2">
            {standings.map((row) => (
              <StandingRow key={row.alias} row={row} bonusOn={bonusOn} partyCount={state.partyCount} showWinnings={state.stake != null} />
            ))}
          </ol>
        </div>
      ) : null}

      {state.own?.breakdown ? (
        <div className="space-y-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
          <div>
            <p className="text-xs font-medium text-primary">רק אתם רואים את זה</p>
            <h3 className="font-heading text-2xl">הפער של {state.own.alias}</h3>
            <p className="text-sm text-muted-foreground">
              מקום {formatNumber(state.own.breakdown.rank)} · מושבים לא במקום {formatScore(state.own.breakdown.misplaced)} ·
              סטיות {formatNumber(state.own.breakdown.absolute)}
              {bonusOn
                ? ` · חסימה נכונה ${formatNumber(state.own.breakdown.thresholdCorrect)} מתוך ${formatNumber(state.partyCount)}`
                : ""}
            </p>
          </div>
          <ul className="divide-y divide-primary/15">
            {state.own.breakdown.parties.map((party) => (
              <li key={party.partyId} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-1.5 text-sm">
                <span className="truncate">
                  {party.name}
                  {bonusOn ? (
                    <span className="text-muted-foreground">{party.passedCall ? " · חסימה נכונה" : " · חסימה לא"}</span>
                  ) : null}
                </span>
                <span className="tabular-nums text-muted-foreground">{formatNumber(party.predicted)}</span>
                <span className="tabular-nums">{formatNumber(party.actual)}</span>
                <span className={`tabular-nums ${party.diff === 0 ? "text-muted-foreground" : "font-medium"}`}>
                  {formatSigned(party.diff)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">העמודות: הניחוש שלכם, התוצאה, ההפרש.</p>
        </div>
      ) : null}

      {state.aliases.length > 0 ? (
        <p className="text-sm text-muted-foreground">במשחק: {state.aliases.join(", ")}</p>
      ) : null}
    </section>
  );
}

function mergePublic(current: PublicGroupState, next: PublicStandingsPayload): PublicGroupState {
  const alias = current.own?.alias;
  const standings = next.standings.map((row) => ({ ...row, isYou: alias != null && row.alias === alias }));
  const mine = alias ? standings.find((row) => row.alias === alias) : undefined;
  const own =
    current.own && current.own.breakdown && mine
      ? { ...current.own, breakdown: { ...current.own.breakdown, rank: mine.rank } }
      : current.own;
  return {
    ...current,
    participantCount: next.participantCount,
    completeCount: next.completeCount,
    aliases: next.aliases,
    fetchProblem: next.fetchProblem,
    results: next.results,
    standings,
    thresholdBonus: next.thresholdBonus,
    partyCount: next.partyCount,
    stake: next.stake,
    own,
  };
}

function applyOwn(current: PublicGroupState, own: OwnView | null): PublicGroupState {
  const alias = own?.alias;
  return {
    ...current,
    own,
    standings: current.standings.map((row) => ({ ...row, isYou: alias != null && row.alias === alias })),
  };
}

function StandingRow({
  row,
  bonusOn,
  partyCount,
  showWinnings,
}: {
  row: GroupStanding;
  bonusOn: boolean;
  partyCount: number;
  showWinnings: boolean;
}) {
  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 ring-1 ring-foreground/10 ${
        row.isYou ? "bg-primary/10" : "bg-card"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="font-heading w-8 text-2xl tabular-nums">{formatNumber(row.rank)}</span>
        <span className="truncate font-medium">
          {row.alias}
          {row.isYou ? <span className="text-primary"> · אתם</span> : null}
        </span>
      </div>
      <div className="text-end text-sm tabular-nums">
        <div className="font-medium">{formatScore(row.misplaced)}</div>
        <div className="text-xs text-muted-foreground">מושבים לא במקום</div>
        <div className="text-xs text-muted-foreground">סטיות {formatNumber(row.absolute)}</div>
        {showWinnings && row.winningsAgorot > 0 ? (
          <div className="text-xs text-muted-foreground">{formatIls(row.winningsAgorot)}</div>
        ) : null}
        {bonusOn ? (
          <div className="text-xs text-muted-foreground">
            חסימה {formatNumber(row.thresholdCorrect)}/{formatNumber(partyCount)}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function sourceLabel(source: "official" | "upload" | "manual") {
  if (source === "official") return "ועדת הבחירות המרכזית";
  if (source === "upload") return "קובץ מוועדת הבחירות";
  return "הזנה ידנית";
}
