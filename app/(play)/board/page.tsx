import Link from "next/link";
import { NationalBoardLive } from "@/components/national-board";
import { Shell } from "@/components/shell";
import { getDb } from "@/lib/db";
import { globalLeaderboard } from "@/lib/leaderboard";

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const query = await searchParams;
  const page = Number(query.page || "1");
  const board = await globalLeaderboard(await getDb(), { page, pageSize: 40 });
  return (
    <Shell wide>
      <header className="mt-6 space-y-2">
        <h1 className="font-heading text-5xl leading-none">הדירוג הארצי</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          כל הקבוצות שבחרו להופיע. המספר הגדול הוא מושבים לא במקום. רואים כינוי ושם קבוצה, לא את חלוקת המושבים.
        </p>
      </header>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Link href="/scoring" className="text-primary underline-offset-4 hover:underline">
          איך מחשבים את הציון
        </Link>
      </p>
      <NationalBoardLive initial={board} page={board.page} />
      <Pager page={board.page} pageCount={board.pageCount} />
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-4 hover:underline">
          פתיחת קבוצה
        </Link>
      </p>
    </Shell>
  );
}

function Pager({ page, pageCount }: { page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const href = (next: number) => (next <= 1 ? "/board" : `/board?page=${next}`);
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
