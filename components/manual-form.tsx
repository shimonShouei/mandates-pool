"use client";

import { useState } from "react";
import { saveManualAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KNESSET_SEATS } from "@/lib/seats";

type Party = { id: string; name: string; ballot: string };

export function ManualForm({
  code,
  parties,
  initialSeats,
  initialVotes,
}: {
  code: string;
  parties: Party[];
  initialSeats: Record<string, number>;
  initialVotes: Record<string, number | null>;
}) {
  const [seats, setSeats] = useState(initialSeats);
  const total = parties.reduce((sum, party) => sum + (seats[party.id] ?? 0), 0);

  return (
    <ActionForm action={saveManualAction} className="space-y-3">
      <input type="hidden" name="code" value={code} />
      <p className="text-sm text-muted-foreground">
        כשהמשיכה מוועדת הבחירות לא זמינה, מזינים כאן. סכום המנדטים חייב להיות 120, אלא אם מחשבים אותם מהקולות.
      </p>
      <ul className="space-y-2">
        {parties.map((party) => (
          <li key={party.id} className="grid grid-cols-[1fr_5rem_6.5rem] items-center gap-2">
            <span className="truncate text-sm">
              {party.name}
              <span dir="ltr" className="text-muted-foreground">
                {" "}
                {party.ballot}
              </span>
            </span>
            <Input
              aria-label={`מנדטים ${party.name}`}
              inputMode="numeric"
              className="h-10 text-center tabular-nums"
              value={seats[party.id] ?? 0}
              onChange={(event) => {
                const next = event.target.value.trim();
                if (next !== "" && !/^\d+$/.test(next)) return;
                setSeats((current) => ({ ...current, [party.id]: next === "" ? 0 : Number(next) }));
              }}
            />
            <Input
              name={`votes_${party.id}`}
              aria-label={`קולות ${party.name}`}
              inputMode="numeric"
              className="h-10 text-center tabular-nums"
              placeholder="קולות"
              defaultValue={initialVotes[party.id] ?? ""}
            />
            <input type="hidden" name={`seats_${party.id}`} value={seats[party.id] ?? 0} />
          </li>
        ))}
      </ul>
      <p className={`text-sm tabular-nums ${total === KNESSET_SEATS ? "text-primary" : "text-destructive"}`}>
        סכום מנדטים: {total} / {KNESSET_SEATS}
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="computeFromVotes" value="1" />
        חשבו מנדטים מהקולות (באדר-עופר והסכמי העודפים)
      </label>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="counted">אחוז קולות שנספרו</Label>
          <Input id="counted" name="countedPercent" inputMode="decimal" className="h-10" placeholder="63.5" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="status">סטטוס</Label>
          <select id="status" name="status" className="h-10 w-full rounded-lg border border-input bg-card px-2 text-sm">
            <option value="provisional">ארעי</option>
            <option value="final">סופי</option>
          </select>
        </div>
      </div>
      <input type="hidden" name="turnoutPercent" value="" />
      <Button type="submit" className="h-11">
        שמירת עקיפה ידנית
      </Button>
    </ActionForm>
  );
}
