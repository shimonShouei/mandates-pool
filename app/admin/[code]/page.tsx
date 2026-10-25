import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  addAgreementAction,
  assignUnmappedAction,
  deletePartyAction,
  lockNow,
  movePartyAction,
  refreshOfficialAction,
  removeAgreementAction,
  resumeAutoAction,
  savePartyAction,
  updateGroupAction,
  uploadResultsAction,
} from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { CopyCode } from "@/components/copy-code";
import { ManualForm } from "@/components/manual-form";
import { Shell } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDb } from "@/lib/db";
import { formatPercent, formatWhen } from "@/lib/format";
import { getGroupByCode, getPublicState, listAgreements, listParticipantsAdmin, listParties } from "@/lib/game";
import { isAdmin } from "@/lib/session";
import { isoToJerusalemLocal, lockSchedule } from "@/lib/time";

export default async function AdminGroupPage({ params }: { params: Promise<{ code: string }> }) {
  if (!(await isAdmin())) redirect("/admin");
  const { code } = await params;
  const db = await getDb();
  const group = await getGroupByCode(db, code);
  if (!group) notFound();

  const [parties, agreements, people, state] = await Promise.all([
    listParties(db, group.id),
    listAgreements(db, group.id),
    listParticipantsAdmin(db, group.id),
    getPublicState(db, group.id, null),
  ]);

  const seats: Record<string, number> = {};
  const votes: Record<string, number | null> = {};
  for (const party of parties) {
    const row = state.results?.parties.find((item) => item.name === party.name);
    seats[party.id] = row?.seats ?? 0;
    votes[party.id] = row?.votes ?? null;
  }

  return (
    <Shell wide>
      <p className="mt-4 text-sm">
        <Link href="/admin" className="text-primary underline-offset-4 hover:underline">
          כל הקבוצות
        </Link>
        <span className="text-muted-foreground"> · </span>
        <Link href={`/g/${group.code}`} className="text-primary underline-offset-4 hover:underline">
          דף הקבוצה
        </Link>
      </p>
      <h1 className="mt-2 font-heading text-5xl">{group.name}</h1>
      <div className="mt-3">
        <CopyCode code={group.code} />
      </div>

      <section className="mt-6 space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="font-heading text-2xl">נעילה ומקור</h2>
        <ActionForm action={updateGroupAction}>
          <input type="hidden" name="code" value={group.code} />
          <div className="space-y-1.5">
            <Label htmlFor="gname">שם הקבוצה</Label>
            <Input id="gname" name="name" defaultValue={group.name} className="h-11" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="electionStart">פתיחת הקלפיות, שעון ישראל</Label>
              <Input
                id="electionStart"
                name="electionStart"
                type="datetime-local"
                required
                className="h-11"
                defaultValue={isoToJerusalemLocal(group.electionStart)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gdeadline">נעילה מוקדמת, שעון ישראל (רשות)</Label>
              <Input
                id="gdeadline"
                name="deadline"
                type="datetime-local"
                className="h-11"
                defaultValue={group.deadline ? isoToJerusalemLocal(group.deadline) : ""}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="knesset">מספר הכנסת למשיכת התוצאות</Label>
            <Input id="knesset" name="knesset" inputMode="numeric" defaultValue={group.knessetNumber} className="h-11" />
          </div>
          <p className="text-sm text-muted-foreground">
            הניחושים ננעלים בפתיחת הקלפיות. נעילה מוקדמת יכולה רק להקדים את זה.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="clearDeadline" value="1" className="mt-1" />
            בלי נעילה מוקדמת
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="preferComputed" value="1" defaultChecked={group.preferComputed} className="mt-1" />
            לחשב מנדטים בעצמנו גם כשוועדת הבחירות כבר מפרסמת מנדטים
          </label>
          <Button type="submit" className="h-11">
            שמירה
          </Button>
        </ActionForm>
        <ActionForm action={lockNow}>
          <input type="hidden" name="code" value={group.code} />
          <Button type="submit" variant="outline" className="h-11">
            נעילה עכשיו
          </Button>
        </ActionForm>
        <p className="text-sm text-muted-foreground">
          {describeLock(group.electionStart, group.deadline)}
          {group.resultsOverride ? " עקיפה ידנית פעילה, והרענון האוטומטי מושהה." : " הרענון האוטומטי פעיל."}
        </p>
      </section>

      <section className="mt-6 space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="font-heading text-2xl">תוצאות</h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant={state.results?.status === "final" ? "secondary" : "outline"}>
            {state.results ? (state.results.status === "final" ? "סופי" : "ארעי") : "עדיין אין"}
          </Badge>
          {state.results ? <span className="text-sm text-muted-foreground">{state.results.seatMethod}</span> : null}
        </div>
        {group.fetchError ? <p className="text-sm text-destructive">{group.fetchError}</p> : null}
        {state.results ? (
          <p className="text-sm text-muted-foreground">
            {state.results.status === "final"
              ? "הספירה הסתיימה. "
              : state.results.countedPercent != null
                ? `נספרו ${formatPercent(state.results.countedPercent)} מהקולות. `
                : "אחוז הכיסוי לא פורסם. "}
            עודכן {formatWhen(state.results.fetchedAt)}.
          </p>
        ) : null}
        {state.results?.note ? <p className="whitespace-pre-wrap text-sm text-amber-950">{state.results.note}</p> : null}
        <div className="flex flex-wrap gap-2">
          <ActionForm action={refreshOfficialAction}>
            <input type="hidden" name="code" value={group.code} />
            <Button type="submit" className="h-11">
              משיכה מוועדת הבחירות
            </Button>
          </ActionForm>
          {group.resultsOverride ? (
            <ActionForm action={resumeAutoAction}>
              <input type="hidden" name="code" value={group.code} />
              <Button type="submit" variant="outline" className="h-11">
                ביטול העקיפה ורענון
              </Button>
            </ActionForm>
          ) : null}
        </div>
        <ActionForm action={uploadResultsAction}>
          <input type="hidden" name="code" value={group.code} />
          <Label htmlFor="file">או העלאת דף התוצאות שנשמר מהדפדפן (HTML או JSON)</Label>
          <Input id="file" name="file" type="file" accept=".html,.json,text/html,application/json" className="h-11" />
          <Button type="submit" variant="outline" className="h-11">
            ייבוא מהקובץ
          </Button>
        </ActionForm>
        {state.results?.unmapped.length ? (
          <div className="space-y-2">
            <h3 className="font-medium">רשימות מהמקור בלי שורה אצלנו</h3>
            {state.results.unmapped.map((row) => (
              <ActionForm key={`${row.ballot}-${row.name}`} action={assignUnmappedAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="code" value={group.code} />
                <input type="hidden" name="ballot" value={row.ballot} />
                <input type="hidden" name="sourceName" value={row.name} />
                <span className="text-sm">
                  {row.name} ({row.ballot || "—"}) · {row.seats} מנדטים
                </span>
                <select name="partyId" className="h-10 rounded-lg border border-input bg-card px-2 text-sm">
                  <option value="__new">הוספה כרשימה חדשה</option>
                  {parties.map((party) => (
                    <option key={party.id} value={party.id}>
                      שיוך אל {party.name}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="outline" className="h-10">
                  שיוך
                </Button>
              </ActionForm>
            ))}
          </div>
        ) : null}
        <ManualForm code={group.code} parties={parties} initialSeats={seats} initialVotes={votes} />
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="font-heading text-2xl">רשימות</h2>
        <p className="text-sm text-muted-foreground">
          נקודת הפתיחה היא הרשימות הגדולות לכנסת ה-26 לפי פרסום ועדת הבחירות מ-22 באוקטובר 2026. יש לבדוק אותה לפני הנעילה. אי אפשר למחוק רשימה שכבר ניחשו עליה.
        </p>
        {parties.map((party, index) => (
          <div key={party.id} className="space-y-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
            <ActionForm action={savePartyAction}>
              <input type="hidden" name="code" value={group.code} />
              <input type="hidden" name="partyId" value={party.id} />
              <div className="grid gap-2 sm:grid-cols-[1fr_6rem_4rem]">
                <Input name="name" aria-label="שם" defaultValue={party.name} className="h-10" />
                <Input name="ballot" aria-label="אותיות" dir="ltr" defaultValue={party.ballot} className="h-10 text-center" />
                <Input name="color" aria-label="צבע" type="color" defaultValue={party.color} className="h-10 px-1" />
              </div>
              <Input
                name="matchKeys"
                aria-label="מילות זיהוי"
                defaultValue={party.matchKeys.join(", ")}
                placeholder="שמות נוספים מהאתר הרשמי, מופרדים בפסיק"
                className="h-10"
              />
              <Button type="submit" className="h-10">
                שמירה
              </Button>
            </ActionForm>
            <div className="flex flex-wrap gap-2">
              <ActionForm action={movePartyAction}>
                <input type="hidden" name="code" value={group.code} />
                <input type="hidden" name="partyId" value={party.id} />
                <input type="hidden" name="direction" value="-1" />
                <Button type="submit" variant="outline" className="h-10" disabled={index === 0}>
                  למעלה
                </Button>
              </ActionForm>
              <ActionForm action={movePartyAction}>
                <input type="hidden" name="code" value={group.code} />
                <input type="hidden" name="partyId" value={party.id} />
                <input type="hidden" name="direction" value="1" />
                <Button type="submit" variant="outline" className="h-10" disabled={index === parties.length - 1}>
                  למטה
                </Button>
              </ActionForm>
              <ActionForm action={deletePartyAction}>
                <input type="hidden" name="code" value={group.code} />
                <input type="hidden" name="partyId" value={party.id} />
                <Button type="submit" variant="destructive" className="h-10">
                  מחיקה
                </Button>
              </ActionForm>
            </div>
          </div>
        ))}
        <ActionForm action={savePartyAction} className="rounded-xl border border-dashed border-border p-3">
          <input type="hidden" name="code" value={group.code} />
          <h3 className="font-medium">רשימה חדשה</h3>
          <div className="grid gap-2 sm:grid-cols-[1fr_6rem_4rem]">
            <Input name="name" required placeholder="שם" className="h-10" />
            <Input name="ballot" dir="ltr" placeholder="אות" className="h-10 text-center" />
            <Input name="color" type="color" defaultValue="#57534e" className="h-10 px-1" />
          </div>
          <Input name="matchKeys" placeholder="מילות זיהוי" className="h-10" />
          <Button type="submit" className="h-10">
            הוספה
          </Button>
        </ActionForm>
      </section>

      <section className="mt-6 space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="font-heading text-2xl">הסכמי עודפים</h2>
        <p className="text-sm text-muted-foreground">
          שני שותפים שעברו את אחוז החסימה נספרים יחד בחלוקת המנדטים העודפים. הסכם שהשותף שלו נפל מתבטל. האתר של הוועדה לא מפרסם את ההסכמים, אז מזינים אותם כאן לפני ליל הבחירות.
        </p>
        {agreements.length === 0 ? <p className="text-sm">אין הסכמים.</p> : null}
        <ul className="space-y-2">
          {agreements.map((agreement) => (
            <li key={agreement.id} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {agreement.partyAName} + {agreement.partyBName}
              </span>
              <ActionForm action={removeAgreementAction}>
                <input type="hidden" name="code" value={group.code} />
                <input type="hidden" name="agreementId" value={agreement.id} />
                <Button type="submit" variant="outline" className="h-9">
                  הסרה
                </Button>
              </ActionForm>
            </li>
          ))}
        </ul>
        <ActionForm action={addAgreementAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input type="hidden" name="code" value={group.code} />
          <select name="partyA" className="h-11 rounded-lg border border-input bg-card px-2" defaultValue="">
            <option value="" disabled>
              רשימה
            </option>
            {parties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name}
              </option>
            ))}
          </select>
          <select name="partyB" className="h-11 rounded-lg border border-input bg-card px-2" defaultValue="">
            <option value="" disabled>
              שותפה
            </option>
            {parties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name}
              </option>
            ))}
          </select>
          <Button type="submit" className="h-11">
            הוספת הסכם
          </Button>
        </ActionForm>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="font-heading text-2xl">משתתפים</h2>
        <p className="text-sm text-muted-foreground">רואים מי נכנס ואם הניחוש שלו שלם. לא את המנדטים.</p>
        {people.length === 0 ? <p className="text-sm">עוד אין משתתפים.</p> : null}
        <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-foreground/10">
          {people.map((person) => (
            <li key={person.alias} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>
                {person.alias}
                <span className="block text-xs text-muted-foreground">{formatWhen(person.joinedAt)}</span>
              </span>
              <span>{person.complete ? "ניחוש שלם" : "עדיין לא 120"}</span>
            </li>
          ))}
        </ul>
      </section>
    </Shell>
  );
}

function describeLock(electionStart: string, deadline: string | null) {
  const schedule = lockSchedule(electionStart, deadline);
  const when = formatWhen(schedule.lockAt);
  const ignored =
    deadline && Date.parse(deadline) >= Date.parse(electionStart)
      ? " שעת הנעילה המוקדמת אינה מאריכה מעבר לפתיחת הקלפיות."
      : "";
  return schedule.reason === "manual"
    ? `נעילה בפועל: ${when}, נעילה מוקדמת.`
    : `נעילה בפועל: ${when}, פתיחת הקלפיות.${ignored}`;
}
