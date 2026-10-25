import Link from "next/link";
import { CrowdLive } from "@/components/crowd-dashboard";
import { Shell } from "@/components/shell";
import { readSiteCrowd } from "@/lib/board-cache";
import { presentCrowd } from "@/lib/crowd";
import { getDb } from "@/lib/db";
import { listParties } from "@/lib/game";

export default async function CrowdPage() {
  const db = await getDb();
  const [report, parties] = await Promise.all([readSiteCrowd(db), listParties(db)]);
  const view = presentCrowd(
    report,
    parties.map((party) => ({ id: party.id, name: party.name, ballot: party.ballot, color: party.color })),
  );
  return (
    <Shell wide>
      <header className="mt-6 space-y-2">
        <h1 className="font-heading text-5xl leading-none">חוכמת ההמונים</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          כל הקבוצות שמופיעות בדירוג הארצי. ממוצע, חציון וטווח לכל רשימה, וכמה מהניחושים נותנים לגוש 61 מנדטים. בלי
          ניחוש של אדם אחד.
        </p>
      </header>
      <p className="mt-3 text-sm">
        <Link href="/board" className="text-primary underline-offset-4 hover:underline">
          הדירוג הארצי
        </Link>
      </p>
      <CrowdLive initial={view} pollUrl="/api/crowd" />
    </Shell>
  );
}
