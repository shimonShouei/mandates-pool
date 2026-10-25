import Link from "next/link";
import {
  addAgreementAction,
  assignUnmappedAction,
  deletePartyAction,
  loginAdmin,
  logoutAdmin,
  movePartyAction,
  refreshOfficialAction,
  removeAgreementAction,
  resumeAutoAction,
  rotateAdminLinkAction,
  savePartyAction,
  updateSiteAction,
  uploadResultsAction,
} from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { ManualForm } from "@/components/manual-form";
import { Shell } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDb } from "@/lib/db";
import { formatPercent, formatWhen } from "@/lib/format";
import { getSite, listAgreements, listGroups, listParties, loadScoreContext } from "@/lib/game";
import { isAdmin } from "@/lib/session";

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <Shell>
        <h1 className="mt-8 font-heading text-5xl">ניהול האתר</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          הסוד הזה מנהל את התוצאות, רשימת המפלגות והסכמי העודפים. הם משותפים לכל הקבוצות. מנהל קבוצה לא צריך אותו.
        </p>
        <ActionForm action={loginAdmin} className="mt-6 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="secret">סוד מנהל</Label>
            <Input id="secret" name="secret" type="password" autoComplete="current-password" required className="h-11" />
          </div>
          <Button type="submit" className="h-11 w-full">
            כניסה
          </Button>
        </ActionForm>
      </Shell>
    );
  }

  const db = await getDb();
  const [site, parties, agreements, groups, context] = await Promise.all([
    getSite(db),
    listParties(db),
    listAgreements(db),
    listGroups(db),
    loadScoreContext(db),
  ]);
  const results = context.results;
  const seats: Record<string, number> = {};
  const votes: Record<string, number | null> = {};
  for (const party of parties) {
    const row = results?.parties.find((item) => item.name === party.name);
    seats[party.id] = row?.seats ?? 0;
    votes[party.id] = row?.votes ?? null;
  }

  return (
    <Shell wide>
      <div className="mt-6 flex items-center justify-between gap-3">
        <h1 className="font-heading text-5xl">ניהול האתר</h1>
        <form action={logoutAdmin}>
          <Button type="submit" variant="outline" className="h-10">
            יציאה
          </Button>
        </form>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        קבוצה חדשה נפתחת מדף הבית. כאן רק מה שמשותף לכולן.
      </p>

      <section className="mt-6 space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="font-heading text-2xl">מקור התוצאות</h2>
        <ActionForm action={updateSiteAction}>
          <div className="space-y-1.5">
            <Label htmlFor="knesset">מספר הכנסת למשיכת התוצאות</Label>
            <Input id="knesset" name="knesset" inputMode="numeric" defaultValue={site.knessetNumber} className="h-11" />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="preferComputed" value="1" defaultChecked={site.preferComputed} className="mt-1" />
            לחשב מנדטים בעצמנו גם כשוועדת הבחירות כבר מפרסמת מנדטים
          </label>
          <Button type="submit" className="h-11">
            שמירה
          </Button>
        </ActionForm>
        <div className="flex flex-wrap gap-2">
          <Badge variant={results?.status === "final" ? "secondary" : "outline"}>
            {results ? (results.status === "final" ? "סופי" : "ארעי") : "עדיין אין"}
          </Badge>
          {results ? <span className="text-sm text-muted-foreground">{results.seatMethod}</span> : null}
        </div>
        {site.fetchError ? <p className="text-sm text-destructive">{site.fetchError}</p> : null}
        {results ? (
          <p className="text-sm text-muted-foreground">
            {results.status === "final"
              ? "הספירה הסתיימה. "
              : results.countedPercent != null
                ? `נספרו ${formatPercent(results.countedPercent)} מהקולות. `
                : "אחוז הכיסוי לא פורסם. "}
            עודכן {formatWhen(results.fetchedAt)}.
            {site.resultsOverride ? " עקיפה ידנית פעילה." : " הרענון האוטומטי פעיל."}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {site.resultsOverride ? "עקיפה ידנית פעילה." : "הרענון האוטומטי פעיל."}
          </p>
        )}
        {results?.note ? <p className="whitespace-pre-wrap text-sm text-amber-950">{results.note}</p> : null}
        <div className="flex flex-wrap gap-2">
          <ActionForm action={refreshOfficialAction}>
            <Button type="submit" className="h-11">
              משיכה מוועדת הבחירות
            </Button>
          </ActionForm>
          {site.resultsOverride ? (
            <ActionForm action={resumeAutoAction}>
              <Button type="submit" variant="outline" className="h-11">
                ביטול העקיפה ורענון
              </Button>
            </ActionForm>
          ) : null}
        </div>
        <ActionForm action={uploadResultsAction}>
          <Label htmlFor="file">או העלאת דף התוצאות שנשמר מהדפדפן (HTML או JSON)</Label>
          <Input id="file" name="file" type="file" accept=".html,.json,text/html,application/json" className="h-11" />
          <Button type="submit" variant="outline" className="h-11">
            ייבוא מהקובץ
          </Button>
        </ActionForm>
        {results?.unmapped.length ? (
          <div className="space-y-2">
            <h3 className="font-medium">רשימות מהמקור בלי שורה אצלנו</h3>
            {results.unmapped.map((row) => (
              <ActionForm key={`${row.ballot}-${row.name}`} action={assignUnmappedAction} className="flex flex-wrap items-center gap-2">
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
        <ManualForm parties={parties} initialSeats={seats} initialVotes={votes} />
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="font-heading text-2xl">רשימות</h2>
        <p className="text-sm text-muted-foreground">
          הרשימות משותפות לכל הקבוצות. נקודת הפתיחה היא הרשימות הגדולות לכנסת ה-26 לפי פרסום ועדת הבחירות מ-22 באוקטובר 2026. אי אפשר למחוק רשימה שכבר ניחשו עליה.
        </p>
        {parties.map((party, index) => (
          <div key={party.id} className="space-y-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
            <ActionForm action={savePartyAction}>
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
                <input type="hidden" name="partyId" value={party.id} />
                <input type="hidden" name="direction" value="-1" />
                <Button type="submit" variant="outline" className="h-10" disabled={index === 0}>
                  למעלה
                </Button>
              </ActionForm>
              <ActionForm action={movePartyAction}>
                <input type="hidden" name="partyId" value={party.id} />
                <input type="hidden" name="direction" value="1" />
                <Button type="submit" variant="outline" className="h-10" disabled={index === parties.length - 1}>
                  למטה
                </Button>
              </ActionForm>
              <ActionForm action={deletePartyAction}>
                <input type="hidden" name="partyId" value={party.id} />
                <Button type="submit" variant="destructive" className="h-10">
                  מחיקה
                </Button>
              </ActionForm>
            </div>
          </div>
        ))}
        <ActionForm action={savePartyAction} className="rounded-xl border border-dashed border-border p-3">
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
          שני שותפים שעברו את אחוז החסימה נספרים יחד בחלוקת המנדטים העודפים. ההסכמים משותפים לכל הקבוצות.
        </p>
        {agreements.length === 0 ? <p className="text-sm">אין הסכמים.</p> : null}
        <ul className="space-y-2">
          {agreements.map((agreement) => (
            <li key={agreement.id} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {agreement.partyAName} + {agreement.partyBName}
              </span>
              <ActionForm action={removeAgreementAction}>
                <input type="hidden" name="agreementId" value={agreement.id} />
                <Button type="submit" variant="outline" className="h-9">
                  הסרה
                </Button>
              </ActionForm>
            </li>
          ))}
        </ul>
        <ActionForm action={addAgreementAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
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

      <section className="mt-6 space-y-3">
        <h2 className="font-heading text-2xl">קבוצות</h2>
        <p className="text-sm text-muted-foreground">
          קישור ניהול שאבד מוחלף כאן. הקישור החדש מוצג פעם אחת ומבטל את הישן.
        </p>
        {groups.length === 0 ? <p className="text-sm">עוד אין קבוצות.</p> : null}
        <ul className="space-y-2">
          {groups.map((group) => (
            <li key={group.id} className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{group.name}</div>
                  <div dir="ltr" className="text-xs text-muted-foreground">
                    {group.code}
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">
                  {group.publicBoard ? "בדירוג הארצי" : "מוסתרת מהדירוג"}
                  {group.hasAdminLink ? "" : " · אין קישור ניהול"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href={`/g/${group.code}`} className="text-sm text-primary underline-offset-4 hover:underline">
                  דף הקבוצה
                </Link>
                <ActionForm action={rotateAdminLinkAction}>
                  <input type="hidden" name="code" value={group.code} />
                  <Button type="submit" variant="outline" className="h-9">
                    {group.hasAdminLink ? "החלפת קישור ניהול" : "הנפקת קישור ניהול"}
                  </Button>
                </ActionForm>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </Shell>
  );
}
