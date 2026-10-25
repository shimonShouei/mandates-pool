import Link from "next/link";
import { createGroupAction, loginAdmin, logoutAdmin } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDb } from "@/lib/db";
import { listGroups } from "@/lib/game";
import { isAdmin } from "@/lib/session";
import { DEFAULT_ELECTION_DAY, POLLS_OPEN_LOCAL_TIME } from "@/lib/time";

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <Shell>
        <h1 className="mt-8 font-heading text-5xl">כניסת מנהל</h1>
        <p className="mt-2 text-sm text-muted-foreground">הסוד נמצא ב-ADMIN_SECRET. החברים לא צריכים אותו.</p>
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

  const groups = await listGroups(await getDb());

  return (
    <Shell>
      <div className="mt-6 flex items-center justify-between gap-3">
        <h1 className="font-heading text-5xl">ניהול</h1>
        <form action={logoutAdmin}>
          <Button type="submit" variant="outline" className="h-10">
            יציאה
          </Button>
        </form>
      </div>

      <ActionForm action={createGroupAction} className="mt-6 space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="font-heading text-2xl">קבוצה חדשה</h2>
        <div className="space-y-1.5">
          <Label htmlFor="name">שם</Label>
          <Input id="name" name="name" defaultValue="ניחוש הכנסת ה-26" className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="electionStart">פתיחת הקלפיות (שעון ישראל)</Label>
          <Input
            id="electionStart"
            name="electionStart"
            type="datetime-local"
            required
            defaultValue={`${DEFAULT_ELECTION_DAY}T${POLLS_OPEN_LOCAL_TIME}`}
            className="h-11"
          />
          <p className="text-sm text-muted-foreground">הניחושים ננעלים אוטומטית בשעה הזו. ברירת המחדל היא 07:00 ביום הבחירות.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="deadline">נעילה מוקדמת (רשות, שעון ישראל)</Label>
          <Input id="deadline" name="deadline" type="datetime-local" className="h-11" />
        </div>
        <Button type="submit" className="h-11">
          יצירת קבוצה
        </Button>
      </ActionForm>

      <ul className="mt-6 space-y-2">
        {groups.length === 0 ? <li className="text-sm text-muted-foreground">עוד אין קבוצות.</li> : null}
        {groups.map((group) => (
          <li key={group.id}>
            <Link
              href={`/admin/${group.code}`}
              className="flex items-center justify-between rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
            >
              <span>
                <span className="font-medium">{group.name}</span>
                <span dir="ltr" className="mt-0.5 block text-xs text-muted-foreground">
                  {group.code}
                </span>
              </span>
              <span className="text-sm text-primary">ניהול</span>
            </Link>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
