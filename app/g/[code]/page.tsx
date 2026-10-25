import type { Metadata } from "next";
import Link from "next/link";
import { BetForm } from "@/components/bet-form";
import { PlayerMark } from "@/components/player-mark";
import { CopyCode } from "@/components/copy-code";
import { JoinForm } from "@/components/join-form";
import { LockCountdown } from "@/components/lock-status";
import { ResultsBoard } from "@/components/results-board";
import { Shell } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { currentUserId } from "@/auth";
import { getDb } from "@/lib/db";
import { visibilityNote } from "@/lib/bet-history";
import { getGroupByCode, getPublicState, isGroupAdmin, listParties } from "@/lib/game";
import { readGroupAdminToken, readToken } from "@/lib/session";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  try {
    const group = await getGroupByCode(await getDb(), code);
    if (!group) return { title: "אין קבוצה כזאת · מנדטים" };
    const description = `הצטרפו לניחוש המושבים בקבוצה ${group.name}. קוד ${group.code}. הנעילה ב-27.10.2026 בשעה 07:00.`;
    return {
      title: `${group.name} · מנדטים`,
      description,
      openGraph: { title: `${group.name} · מנדטים`, description },
    };
  } catch {
    return { title: "מנדטים" };
  }
}

export default async function GroupPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const db = await getDb();
  const group = await getGroupByCode(db, code);
  if (!group) {
    return (
      <Shell>
        <h1 className="mt-10 font-heading text-4xl">אין קבוצה כזאת</h1>
        <p className="mt-2 text-muted-foreground">הקוד {code} לא מוביל למשחק פתוח.</p>
        <Link href="/" className="mt-4 inline-block text-primary underline-offset-4 hover:underline">
          חזרה לקוד
        </Link>
      </Shell>
    );
  }

  const userId = await currentUserId();
  const token = userId ? null : await readToken(group.id);
  const managing = await isGroupAdmin(db, group.id, await readGroupAdminToken(group.id), userId);
  const [parties, state] = await Promise.all([
    listParties(db),
    getPublicState(db, group.id, token, userId, managing),
  ]);
  const initial: Record<string, number> = {};
  for (const party of parties) {
    initial[party.id] = state.own?.prediction.find((row) => row.partyId === party.id)?.seats ?? 0;
  }
  const serverNow = Date.now();

  return (
    <Shell>
      <header className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">כנסת ה-{state.group.knessetNumber}</Badge>
          {state.group.locked ? <Badge>הניחושים נעולים</Badge> : <Badge variant="outline">פתוח עד הנעילה</Badge>}
          <Badge variant="outline">{state.group.visibility === "open" ? "קבוצה פתוחה" : "קבוצה אנונימית"}</Badge>
        </div>
        <div className="flex items-center gap-3">
          <PlayerMark seed={group.code} />
          <h1 className="font-heading text-5xl leading-none">{group.name}</h1>
        </div>
        <LockCountdown
          lockAt={state.group.lockAt}
          locked={state.group.locked}
          reason={state.group.lockReason}
          serverNow={serverNow}
        />
        <CopyCode code={group.code} />
        <p className="flex flex-wrap gap-3 text-sm">
          <Link href="/board" className="text-primary underline-offset-4 hover:underline">
            הדירוג הארצי
          </Link>
          <Link href={`/g/${group.code}/crowd`} className="text-primary underline-offset-4 hover:underline">
            הקהל בקבוצה
          </Link>
          {managing ? (
            <Link href={`/g/${group.code}/manage`} className="text-primary underline-offset-4 hover:underline">
              ניהול הקבוצה
            </Link>
          ) : null}
        </p>
      </header>

      <div className="mt-6">
        {state.own && !userId ? (
          <p className="mb-3 rounded-xl bg-card px-4 py-3 text-sm leading-relaxed ring-1 ring-foreground/10">
            הניחוש הזה שמור רק בדפדפן.{" "}
            <Link href={`/signin?callbackUrl=/g/${group.code}`} className="text-primary underline-offset-4 hover:underline">
              כניסה
            </Link>{" "}
            מצרפת אותו לחשבון, ואז הוא נפתח גם ממכשיר אחר.
          </p>
        ) : null}
        {state.own ? (
          <BetForm
            code={group.code}
            alias={state.own.alias}
            parties={parties.map((party) => ({
              id: party.id,
              name: party.name,
              ballot: party.ballot,
              color: party.color,
            }))}
            initial={initial}
            locked={state.group.locked}
            lockAt={state.group.lockAt}
            serverNow={serverNow}
            policy={visibilityNote(state.group.visibility, state.group.revealBeforeLock)}
          />
        ) : state.group.locked ? (
          <p className="rounded-xl bg-card px-4 py-3 text-sm ring-1 ring-foreground/10">
            ההצטרפות נסגרה. הניחושים נעולים.
          </p>
        ) : userId ? (
          <JoinForm
            code={group.code}
            lockAt={state.group.lockAt}
            locked={state.group.locked}
            serverNow={serverNow}
            policy={visibilityNote(state.group.visibility, state.group.revealBeforeLock)}
          />
        ) : (
          <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="text-sm leading-relaxed">
              כדי להצטרף נכנסים לחשבון. הכינוי נבחר כאן, והוא מה שמופיע בדירוג. המייל לא.
            </p>
            <Link
              href={`/signin?callbackUrl=${encodeURIComponent(`/g/${group.code}`)}`}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground"
            >
              כניסה
            </Link>
          </div>
        )}
      </div>

      <ResultsBoard code={group.code} initial={state} />
    </Shell>
  );
}
