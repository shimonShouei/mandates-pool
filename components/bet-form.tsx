"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveGroup, saveBet } from "@/app/actions";
import { ConfettiBurst } from "@/components/confetti-burst";
import { Hemicycle } from "@/components/hemicycle";
import { useLocked } from "@/components/lock-status";
import { Button } from "@/components/ui/button";
import { KNESSET_SEATS, clampSeat, seatSumError, seatWarningForParty } from "@/lib/seats";

export type BetParty = {
  id: string;
  name: string;
  ballot: string;
  color: string;
};

export function BetForm({
  code,
  alias,
  parties,
  initial,
  locked,
  lockAt,
  serverNow,
  policy,
}: {
  code: string;
  alias: string;
  parties: BetParty[];
  initial: Record<string, number>;
  locked: boolean;
  lockAt: string;
  serverNow: number;
  policy: string;
}) {
  const router = useRouter();
  const lock = useLocked(lockAt, locked, serverNow);
  const closed = lock.locked;
  const [seats, setSeats] = useState<Record<string, number>>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const total = useMemo(
    () => parties.reduce((sum, party) => sum + (Number.isInteger(seats[party.id]) ? seats[party.id] : 0), 0),
    [parties, seats],
  );

  const partyWarnings = parties
    .map((party) => seatWarningForParty(party.name, seats[party.id] ?? 0))
    .filter((warning): warning is string => Boolean(warning));

  const exact = total === KNESSET_SEATS;
  const counterClass = exact ? "text-success" : "text-destructive";

  function update(id: string, value: number) {
    setSaved(false);
    setSeats((current) => ({ ...current, [id]: clampSeat(value) }));
  }

  return (
    <form
      className="space-y-4"
      action={(formData) => {
        if (closed) return;
        if (total !== KNESSET_SEATS) {
          setError(seatSumError(total));
          setSaved(false);
          return;
        }
        formData.set("seats", JSON.stringify(seats));
        startTransition(async () => {
          const result = await saveBet(formData);
          if (!result.ok) {
            setError(result.error);
            setSaved(false);
            return;
          }
          setError(null);
          setSaved(true);
          setWarnings(result.warnings ?? []);
          router.refresh();
        });
      }}
    >
      <ConfettiBurst fire={saved} />
      <input type="hidden" name="code" value={code} />
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">הניחוש של {alias}</p>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{policy}</p>
          <h2 className="font-heading text-3xl leading-none">120 מנדטים</h2>
        </div>
        <p className={`text-end font-heading text-2xl leading-none tabular-nums ${counterClass}`} aria-live="polite">
          חולקו {total} מתוך {KNESSET_SEATS}
        </p>
      </div>

      <Hemicycle seats={parties.map((party) => ({ color: party.color, count: seats[party.id] ?? 0 }))} />

      <ul className="space-y-2">
        {parties.map((party) => {
          const value = seats[party.id] ?? 0;
          const shown = Math.min(KNESSET_SEATS, Math.max(0, value));
          const warning = seatWarningForParty(party.name, value);
          return (
            <li key={party.id} className="rounded-3xl bg-card px-3 py-3 ring-1 ring-border transition hover:ring-primary/40">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="size-3 shrink-0 rounded-full" style={{ background: party.color }} />
                    <span className="truncate font-medium">{party.name}</span>
                    {party.ballot ? (
                      <span dir="ltr" className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {party.ballot}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div dir="ltr" className="flex items-center gap-1">
                  <button
                    type="button"
                    className="size-11 rounded-xl border border-border text-lg focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-40"
                    disabled={closed || value <= 0}
                    onClick={() => update(party.id, value - 1)}
                    aria-label={`פחות ל${party.name}`}
                  >
                    −
                  </button>
                  <input
                    inputMode="numeric"
                    aria-label={party.name}
                    className="h-11 w-14 rounded-xl border border-input bg-transparent text-center text-base tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    disabled={closed}
                    value={value}
                    onChange={(event) => {
                      const next = event.target.value.trim();
                      if (next === "") {
                        update(party.id, 0);
                        return;
                      }
                      if (!/^\d+$/.test(next)) return;
                      update(party.id, Number(next));
                    }}
                  />
                  <button
                    type="button"
                    className="size-11 rounded-xl border border-border text-lg focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-40"
                    disabled={closed || value >= KNESSET_SEATS}
                    onClick={() => update(party.id, value + 1)}
                    aria-label={`עוד ל${party.name}`}
                  >
                    +
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={KNESSET_SEATS}
                step={1}
                value={shown}
                tabIndex={-1}
                aria-hidden
                inert
                className="pointer-events-none mt-2 h-8 w-full accent-current"
                style={{ accentColor: party.color }}
                onChange={() => undefined}
                onInput={(event) => {
                  event.currentTarget.value = String(shown);
                }}
              />
              {warning ? <p className="mt-1 text-xs text-warning">{warning}</p> : null}
            </li>
          );
        })}
      </ul>

      {partyWarnings.length > 0 && !closed ? (
        <p className="text-sm text-warning">אפשר לשמור גם עם האזהרה. החישוב הסופי לא ייתן 1–3 מנדטים.</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved ? <p className="text-sm text-primary">הניחוש נשמר.</p> : null}
      {warnings.map((warning) => (
        <p key={warning} className="text-sm text-warning">
          {warning}
        </p>
      ))}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <p className={`font-heading text-xl tabular-nums ${counterClass}`} aria-live="polite">
            חולקו {total} מתוך {KNESSET_SEATS}
          </p>
          {closed ? (
            <p className="text-sm font-medium">הניחושים נעולים</p>
          ) : (
            <Button type="submit" className="h-11 px-5" disabled={pending || !exact}>
              {pending ? "שומרים…" : "שמירת ניחוש"}
            </Button>
          )}
        </div>
      </div>

      {closed ? null : <Leave code={code} alias={alias} />}
    </form>
  );
}

function Leave({ code, alias }: { code: string; alias: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="pt-2">
      <button
        type="button"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`למחוק את הניחוש של ${alias} מהקבוצה?`)) return;
          const formData = new FormData();
          formData.set("code", code);
          startTransition(async () => {
            const result = await leaveGroup(formData);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
      >
        מחיקת הניחוש מהמשחק
      </button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
