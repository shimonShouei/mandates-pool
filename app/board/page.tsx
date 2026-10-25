import Link from "next/link";
import { NationalBoardLive } from "@/components/national-board";
import { Shell } from "@/components/shell";
import { getDb } from "@/lib/db";
import { globalLeaderboard } from "@/lib/leaderboard";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; metric?: string }>;
}) {
  const query = await searchParams;
  const metric = query.metric === "absolute" ? "absolute" : "euclidean";
  const page = Number(query.page || "1");
  const board = await globalLeaderboard(await getDb(), { page, metric, pageSize: 40 });
  return (
    <Shell wide>
      <header className="mt-6 space-y-2">
        <h1 className="font-heading text-5xl leading-none">הדירוג הארצי</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          כל הקבוצות שבחרו להופיע. רואים כינוי, שם קבוצה, מקום וציון. לא את חלוקת המושבים.
        </p>
      </header>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <MetricLink href="/board?metric=euclidean" active={metric === "euclidean"}>
          מרחק אוקלידי
        </MetricLink>
        <MetricLink href="/board?metric=absolute" active={metric === "absolute"}>
          סכום סטיות
        </MetricLink>
      </div>
      <NationalBoardLive initial={board} page={board.page} metric={metric} />
      <Pager page={board.page} pageCount={board.pageCount} metric={metric} />
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-4 hover:underline">
          פתיחת קבוצה
        </Link>
      </p>
    </Shell>
  );
}

function MetricLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 ring-1 ring-foreground/15 ${active ? "bg-primary text-primary-foreground" : "bg-card"}`}
    >
      {children}
    </Link>
  );
}

function Pager({ page, pageCount, metric }: { page: number; pageCount: number; metric: string }) {
  if (pageCount <= 1) return null;
  const href = (next: number) => `/board?metric=${metric}&page=${next}`;
  return (
    <nav className="mt-4 flex items-center justify-between text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className="text-primary underline-offset-4 hover:underline">
          הקודם
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground">
        עמוד {page} מתוך {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={href(page + 1)} className="text-primary underline-offset-4 hover:underline">
          הבא
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
