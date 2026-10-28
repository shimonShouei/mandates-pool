import { formatNumber, formatWhen } from "@/lib/format";
import type { BetRevision, OwnPrediction, RevealedBet } from "@/lib/public-state";

export function OwnHistory({ alias, history }: { alias: string; history: BetRevision[] }) {
  return (
    <section className="mt-6 space-y-3">
      <h2 className="font-heading text-3xl">הגרסאות של {alias}</h2>
      <p className="text-sm text-muted-foreground">כל שמירה נשמרת עם השעה. את ההיסטוריה הזו רואים רק אתם, כל עוד הקבוצה אנונימית.</p>
      <RevisionList history={history} />
    </section>
  );
}

export function BetRoster({ people }: { people: RevealedBet[] }) {
  return (
    <section className="mt-8 space-y-4">
      <div>
        <h2 className="font-heading text-3xl">הניחושים בקבוצה</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          חברי הקבוצה רואים את חלוקת המושבים ואת השינויים. המייל לא מופיע כאן. הדירוג הארצי נשאר בלי הניחוש עצמו.
        </p>
      </div>
      {people.length === 0 ? <p className="text-sm">עוד אין משתתפים.</p> : null}
      <div className="space-y-4">
        {people.map((person) => (
          <article key={person.alias} className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h3 className="font-heading text-2xl">
              {person.alias}
              {person.isYou ? <span className="text-base text-muted-foreground"> · אתם</span> : null}
            </h3>
            {person.submitted ? <SeatGrid prediction={person.prediction} /> : <p className="text-sm">עדיין אין ניחוש שמור.</p>}
            <div>
              <h4 className="text-sm font-medium">היסטוריה</h4>
              <RevisionList history={person.history} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SeatGrid({ prediction }: { prediction: OwnPrediction[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      {prediction.map((party) => (
        <li key={party.partyId} className="flex min-w-0 items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: party.color }} />
            <span className="truncate">{party.name}</span>
          </span>
          <span className="shrink-0 tabular-nums">{formatNumber(party.seats)}</span>
        </li>
      ))}
    </ul>
  );
}

function RevisionList({ history }: { history: BetRevision[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">עוד אין שמירה. כל שמירה תתועד כאן.</p>;
  }
  return (
    <ol className="mt-2 space-y-3">
      {history.map((revision, index) => (
        <li key={`${revision.savedAt}-${index}`} className="text-sm">
          <p className="font-medium">
            {formatWhen(revision.savedAt)}
            <span className="font-normal text-muted-foreground">
              {" "}
              · {index === 0 ? "ניחוש ראשון" : revision.changes.length === 0 ? "שמירה בלי שינוי" : "שינוי"}
            </span>
          </p>
          {revision.changes.length > 0 ? (
            <ul className="mt-1 space-y-1">
              {revision.changes.map((change) => (
                <li key={change.partyId} className="flex min-w-0 items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: change.color }} />
                    <span className="truncate">{change.name}</span>
                  </span>
                  <span dir="ltr" className="shrink-0 tabular-nums">
                    {formatNumber(change.before)} → {formatNumber(change.after)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
