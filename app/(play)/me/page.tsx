import Link from "next/link";
import { redirect } from "next/navigation";
import { createPublicGroupAction, goToCode } from "@/app/actions";
import { signOutAction } from "@/app/(play)/signin/actions";
import { currentUser } from "@/auth";
import { ActionForm } from "@/components/action-form";
import { Shell } from "@/components/shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listMyGroups, type MyGroup } from "@/lib/accounts";
import { claimDeviceIdentity } from "@/lib/claim-device";
import { getDb } from "@/lib/db";
import { formatIls, formatNumber } from "@/lib/format";
import { cn } from "cn";

export default async function MyGroupsPage() {
  await claimDeviceIdentity();
  const user = await currentUser();
  if (!user) redirect("/signin?callbackUrl=/me");
  const groups = await listMyGroups(await getDb(), user.id);
  return (
    <Shell wide>
      <header className="mt-6 space-y-3">
        <h1 className="font-heading text-5xl leading-none">הקבוצות שלי</h1>
        <p className="text-sm text-muted-foreground">
          מחוברים כ-<span dir="ltr">{user.email}</span>. הכתובת הזו לא מופיעה בדירוג.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a href="#open" className={cn(buttonVariants(), "h-11 px-4")}>
            קבוצה חדשה
          </a>
          <a href="#join" className={cn(buttonVariants({ variant: "outline" }), "h-11 bg-background px-4")}>
            יש לי קוד
          </a>
        </div>
      </header>

      {groups.length === 0 ? (
        <p className="mt-6 rounded-xl bg-card px-4 py-3 text-sm leading-relaxed ring-1 ring-foreground/10">
          עוד אין קבוצות על החשבון הזה. פותחים קבוצה חדשה, או נכנסים עם קוד שקיבלתם.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {groups.map((group) => (
            <GroupCard key={group.code} group={group} />
          ))}
        </ul>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <ActionForm id="open" action={createPublicGroupAction} className="scroll-mt-24 space-y-3 rounded-3xl bg-card p-4 ring-1 ring-border">
          <h2 className="font-heading text-2xl">קבוצה חדשה</h2>
          <div className="space-y-1.5">
            <Label htmlFor="group-name">שם הקבוצה</Label>
            <Input id="group-name" name="name" required minLength={2} maxLength={40} placeholder="למשל חברים מהעבודה" className="h-11" />
          </div>
          <Button type="submit" className="h-11 w-full">
            יצירת קבוצה
          </Button>
        </ActionForm>
        <form id="join" action={goToCode} className="scroll-mt-24 space-y-3 rounded-3xl bg-card p-4 ring-1 ring-border">
          <h2 className="font-heading text-2xl">יש לכם כבר קוד?</h2>
          <div className="space-y-1.5">
            <Label htmlFor="code">קוד הקבוצה</Label>
            <Input
              id="code"
              name="code"
              required
              dir="ltr"
              autoCapitalize="characters"
              placeholder="למשל 7K3M9Q2A"
              className="h-12 text-center text-lg tracking-[0.2em]"
            />
          </div>
          <Button type="submit" variant="outline" className="h-11 w-full">
            כניסה לקבוצה
          </Button>
        </form>
      </div>

      <form action={signOutAction} className="mt-6">
        <Button type="submit" variant="outline" className="h-11">
          יציאה
        </Button>
      </form>
    </Shell>
  );
}

function peopleLabel(count: number): string {
  if (count === 0) return "אין משתתפים";
  if (count === 1) return "משתתף אחד";
  return `${formatNumber(count)} משתתפים`;
}

function GroupCard({ group }: { group: MyGroup }) {
  return (
    <li className="rounded-3xl bg-card p-4 ring-1 ring-border">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-heading text-3xl leading-none">{group.name}</h2>
        {group.owned ? (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">מנהל</span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {group.stakeAgorot > 0 ? `השתתפות ${formatIls(group.stakeAgorot)}` : "בלי קופה"}
        {" · "}
        {peopleLabel(group.participants)}
        {group.alias ? ` · הכינוי ${group.alias}` : ""}
      </p>
      <p className="mt-1 text-sm">{group.alias ? (group.betSubmitted ? "הניחוש נשמר" : "הניחוש עוד לא מלא") : "עוד לא הצטרפתם כמשתתפים"}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {group.alias ? (
          <Link href={`/g/${group.code}#bet`} className={cn(buttonVariants(), "h-11 px-4")}>
            להימור שלי
          </Link>
        ) : (
          <Link href={`/g/${group.code}#bet`} className={cn(buttonVariants(), "h-11 px-4")}>
            הצטרף והמר
          </Link>
        )}
        <Link href={`/g/${group.code}#board`} className={cn(buttonVariants({ variant: "outline" }), "h-11 bg-background px-4")}>
          טבלת הדירוג
        </Link>
        {group.owned ? (
          <Link href={`/g/${group.code}/manage`} className={cn(buttonVariants({ variant: "outline" }), "h-11 bg-background px-4")}>
            ניהול הקבוצה
          </Link>
        ) : null}
      </div>
    </li>
  );
}
