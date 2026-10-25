"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveGroup, saveBet } from "@/app/actions";
import { useLocked } from "@/components/lock-status";
import { Button } from "@/components/ui/button";
import { KNESSET_SEATS, seatWarningForParty } from "@/lib/seats";

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
}: {
  code: string;
  alias: string;
  parties: BetParty[];
  initial: Record<string, number>;
  locked: boolean;
  lockAt: string;
  serverNow: number;
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

  const dots: string[] = [];
  for (const party of parties) {
    const count = Math.max(0, seats[party.id] ?? 0);
    for (let index = 0; index < count && dots.length < KNESSET_SEATS; index += 1) dots.push(party.color);
  }

  function update(id: string, value: number) {
    setSaved(false);
    setSeats((current) => ({ ...current, [id]: value }));
  }

  return (
    <form
      className="space-y-4"
      action={(formData) => {
        if (closed) return;
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
      <input type="hidden" name="code" value={code} />
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">הניחוש של {alias}</p>
          <h2 className="font-heading text-3xl leading-none">120 מנדטים</h2>
        </div>
        <p className={`font-heading text-4xl tabular-nums ${total === KNESSET_SEATS ? "text-primary" : "text-destructive"}`}>
          {total}
        </p>
      </div>

      <div className="grid grid-cols-12 gap-1" aria-hidden="true">
        {Array.from({ length: KNESSET_SEATS }, (_, index) => (
          <span
            key={index}
            className="aspect-square rounded-[3px] border border-foreground/10"
            style={{ background: dots[index] ?? "transparent" }}
          />
        ))}
      </div>
      {total > KNESSET_SEATS ? (
        <p className="text-sm text-destructive">יש {total - KNESSET_SEATS} מנדטים מעל 120.</p>
      ) : null}

      <ul className="space-y-2">
        {parties.map((party) => {
          const value = seats[party.id] ?? 0;
          const warning = seatWarningForParty(party.name, value);
          return (
            <li key={party.id} className="rounded-xl bg-card px-3 py-2 ring-1 ring-foreground/10">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: party.color }} />
                    <span className="truncate font-medium">{party.name}</span>
                  </div>
                  {party.ballot ? (
                    <div dir="ltr" className="ps-4 text-xs text-muted-foreground">
                      {party.ballot}
                    </div>
                  ) : null}
                </div>
                <div dir="ltr" className="flex items-center gap-1">
                  <button
                    type="button"
                    className="size-11 rounded-lg border border-border text-lg disabled:opacity-40"
                    disabled={closed || value <= 0}
                    onClick={() => update(party.id, value - 1)}
                    aria-label={`פחות ל${party.name}`}
                  >
                    −
                  </button>
                  <input
                    inputMode="numeric"
                    aria-label={party.name}
                    className="h-11 w-14 rounded-lg border border-input bg-transparent text-center text-base tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
                    className="size-11 rounded-lg border border-border text-lg disabled:opacity-40"
                    disabled={closed}
                    onClick={() => update(party.id, value + 1)}
                    aria-label={`עוד ל${party.name}`}
                  >
                    +
                  </button>
                </div>
              </div>
              {warning ? <p className="mt-1 text-xs text-amber-800">{warning}</p> : null}
            </li>
          );
        })}
      </ul>

      {partyWarnings.length > 0 && !closed ? (
        <p className="text-sm text-amber-900">אפשר לשמור גם עם האזהרה. החישוב הסופי לא ייתן 1–3 מנדטים.</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved ? <p className="text-sm text-primary">הניחוש נשמר במכשיר הזה.</p> : null}
      {warnings.map((warning) => (
        <p key={warning} className="text-sm text-amber-900">
          {warning}
        </p>
      ))}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">סכום</div>
            <div className={`font-heading text-2xl tabular-nums ${total === KNESSET_SEATS ? "text-primary" : "text-destructive"}`}>
              {total} / {KNESSET_SEATS}
            </div>
          </div>
          {closed ? (
            <p className="text-sm font-medium">הניחושים נעולים</p>
          ) : (
            <Button type="submit" className="h-11 px-5" disabled={pending || total !== KNESSET_SEATS}>
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
          if (!window.confirm(`למחוק את הניחוש של ${alias} מהמכשיר הזה?`)) return;
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
