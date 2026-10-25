import Link from "next/link";
import { BetForm } from "@/components/bet-form";
import { CopyCode } from "@/components/copy-code";
import { JoinForm } from "@/components/join-form";
import { LockCountdown } from "@/components/lock-status";
import { ResultsBoard } from "@/components/results-board";
import { Shell } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/lib/db";
import { getGroupByCode, getPublicState, isGroupAdmin, listParties } from "@/lib/game";
import { readGroupAdminToken, readToken } from "@/lib/session";

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

  const token = await readToken(group.id);
  const [parties, state, managing] = await Promise.all([
    listParties(db),
    getPublicState(db, group.id, token),
    isGroupAdmin(db, group.id, await readGroupAdminToken(group.id)),
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
        </div>
        <h1 className="font-heading text-5xl leading-none">{group.name}</h1>
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
          />
        ) : state.group.locked ? (
          <p className="rounded-xl bg-card px-4 py-3 text-sm ring-1 ring-foreground/10">
            ההצטרפות נסגרה. הניחושים נעולים.
          </p>
        ) : (
          <JoinForm code={group.code} lockAt={state.group.lockAt} locked={state.group.locked} serverNow={serverNow} />
        )}
      </div>

      <ResultsBoard code={group.code} initial={state} />
    </Shell>
  );
}
