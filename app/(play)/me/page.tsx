import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { signOutAction } from "@/app/(play)/signin/actions";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { listMyGroups } from "@/lib/accounts";
import { claimDeviceIdentity } from "@/lib/claim-device";
import { getDb } from "@/lib/db";

export default async function MyBetsPage() {
  await claimDeviceIdentity();
  const user = await currentUser();
  if (!user) redirect("/signin?callbackUrl=/me");
  const groups = await listMyGroups(await getDb(), user.id);
  return (
    <Shell>
      <header className="mt-8 space-y-2">
        <h1 className="font-heading text-5xl leading-none">הניחושים שלי</h1>
        <p className="text-sm text-muted-foreground">
          מחוברים כ-<span dir="ltr">{user.email}</span>. הכתובת הזו לא מופיעה בדירוג.
        </p>
      </header>
      {groups.length === 0 ? (
        <p className="mt-6 rounded-xl bg-card px-4 py-3 text-sm ring-1 ring-foreground/10">
          עוד אין ניחוש על החשבון הזה. נכנסים לקבוצה עם הקוד, ובוחרים כינוי.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {groups.map((group) => (
            <li key={group.code}>
              <Link
                href={`/g/${group.code}`}
                className="block rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
              >
                <span className="font-medium">{group.name}</span>
                <span className="mt-1 block text-sm text-muted-foreground">הכינוי בקבוצה: {group.alias}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <form action={signOutAction} className="mt-6">
        <Button type="submit" variant="outline" className="h-11">
          יציאה
        </Button>
      </form>
    </Shell>
  );
}
