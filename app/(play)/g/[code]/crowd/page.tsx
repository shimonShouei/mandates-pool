import Link from "next/link";
import { CrowdLive } from "@/components/crowd-dashboard";
import { Shell } from "@/components/shell";
import { readGroupCrowd } from "@/lib/board-cache";
import { presentCrowd } from "@/lib/crowd";
import { getDb } from "@/lib/db";
import { getGroupByCode, listParties } from "@/lib/game";

export default async function GroupCrowdPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
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
  const [report, parties] = await Promise.all([readGroupCrowd(db, group.id), listParties(db)]);
  const view = presentCrowd(
    report,
    parties.map((party) => ({ id: party.id, name: party.name, ballot: party.ballot, color: party.color })),
  );
  return (
    <Shell wide>
      <header className="mt-6 space-y-2">
        <p className="text-sm">
          <Link href={`/g/${group.code}`} className="text-primary underline-offset-4 hover:underline">
            {group.name}
          </Link>
        </p>
        <h1 className="font-heading text-5xl leading-none">הקהל בקבוצה</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          רק הניחושים השלמים בקבוצה הזאת. אותו סיכום כמו באתר כולו, בלי לחשוף איך מישהו חילק.
        </p>
      </header>
      <CrowdLive initial={view} pollUrl={`/api/groups/${group.code}/crowd`} />
    </Shell>
  );
}
