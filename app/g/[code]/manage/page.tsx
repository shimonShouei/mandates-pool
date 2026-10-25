import Link from "next/link";
import { lockNow, updateGroupAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { ClaimAdmin } from "@/components/claim-admin";
import { CopyCode } from "@/components/copy-code";
import { CopyLink } from "@/components/copy-link";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDb } from "@/lib/db";
import { formatWhen } from "@/lib/format";
import { getGroupByCode, isGroupAdmin, listParticipantsAdmin } from "@/lib/game";
import { readGroupAdminToken } from "@/lib/session";
import { isoToJerusalemLocal, lockSchedule } from "@/lib/time";

export default async function ManageGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ k?: string; welcome?: string }>;
}) {
  const { code } = await params;
  const query = await searchParams;
  const db = await getDb();
  const group = await getGroupByCode(db, code);
  if (!group) {
    return (
      <Shell>
        <h1 className="mt-10 font-heading text-4xl">אין קבוצה כזאת</h1>
        <Link href="/" className="mt-4 inline-block text-primary underline-offset-4 hover:underline">
          חזרה
        </Link>
      </Shell>
    );
  }

  if (query.k) {
    return (
      <Shell>
        <h1 className="mt-8 font-heading text-4xl">ניהול {group.name}</h1>
        <ClaimAdmin code={group.code} token={query.k} />
      </Shell>
    );
  }

  const token = await readGroupAdminToken(group.id);
  const allowed = await isGroupAdmin(db, group.id, token);
  if (!allowed || !token) {
    return (
      <Shell>
        <h1 className="mt-8 font-heading text-4xl">ניהול {group.name}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          הדף הזה נפתח רק עם קישור הניהול הפרטי שנוצר עם הקבוצה. אם הקישור אבד, מנהל האתר יכול להנפיק אחד חדש.
        </p>
        <Link href={`/g/${group.code}`} className="mt-4 inline-block text-primary underline-offset-4 hover:underline">
          לדף הקבוצה
        </Link>
      </Shell>
    );
  }

  const people = await listParticipantsAdmin(db, group.id);
  const schedule = lockSchedule(group.electionStart, group.deadline);

  return (
    <Shell>
      <p className="mt-4 text-sm">
        <Link href={`/g/${group.code}`} className="text-primary underline-offset-4 hover:underline">
          דף הקבוצה
        </Link>
        <span className="text-muted-foreground"> · </span>
        <Link href="/board" className="text-primary underline-offset-4 hover:underline">
          הדירוג הארצי
        </Link>
      </p>
      <h1 className="mt-2 font-heading text-5xl">ניהול {group.name}</h1>
      {query.welcome ? (
        <p className="mt-3 rounded-xl bg-card px-4 py-3 text-sm ring-1 ring-foreground/10">
          הקבוצה נפתחה. שמרו את קישור הניהול. מי שיש לו אותו יכול לשנות את הקבוצה, ואין שחזור בלי מנהל האתר.
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        <CopyCode code={group.code} />
        <CopyLink
          label="קישור ניהול פרטי"
          display={`/g/${group.code}/manage?k=••••`}
          path={`/g/${group.code}/manage?k=${token}`}
        />
      </div>

      <section className="mt-6 space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="font-heading text-2xl">הקבוצה</h2>
        <ActionForm action={updateGroupAction}>
          <input type="hidden" name="code" value={group.code} />
          <div className="space-y-1.5">
            <Label htmlFor="gname">שם</Label>
            <Input id="gname" name="name" required minLength={2} maxLength={40} defaultValue={group.name} className="h-11" />
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
              <Label htmlFor="gdeadline">נעילה מוקדמת, שעון ישראל</Label>
              <Input
                id="gdeadline"
                name="deadline"
                type="datetime-local"
                className="h-11"
                defaultValue={group.deadline ? isoToJerusalemLocal(group.deadline) : ""}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {schedule.reason === "manual"
              ? `נעילה בפועל: ${formatWhen(schedule.lockAt)}, נעילה מוקדמת.`
              : `נעילה בפועל: ${formatWhen(schedule.lockAt)}, פתיחת הקלפיות.`}{" "}
            נעילה מוקדמת יכולה רק להקדים את פתיחת הקלפיות.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="clearDeadline" value="1" className="mt-1" />
            בלי נעילה מוקדמת
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="publicBoard" value="1" defaultChecked={group.publicBoard} className="mt-1" />
            הקבוצה מופיעה בדירוג הארצי
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
