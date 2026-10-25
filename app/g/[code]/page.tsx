import Link from "next/link";
import { BetForm } from "@/components/bet-form";
import { CopyCode } from "@/components/copy-code";
import { JoinForm } from "@/components/join-form";
import { ResultsBoard } from "@/components/results-board";
import { Shell } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/lib/db";
import { formatWhen } from "@/lib/format";
import { getGroupByCode, getPublicState, listParties } from "@/lib/game";
import { readToken } from "@/lib/session";

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
  const [parties, state] = await Promise.all([
    listParties(db, group.id),
    getPublicState(db, group.id, token),
  ]);
  const initial: Record<string, number> = {};
  for (const party of parties) {
    initial[party.id] = state.own?.prediction.find((row) => row.partyId === party.id)?.seats ?? 0;
  }

  return (
    <Shell>
      <header className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">כנסת ה-{group.knessetNumber}</Badge>
          {state.group.locked ? <Badge variant="outline">הניחושים נעולים</Badge> : null}
        </div>
        <h1 className="font-heading text-5xl leading-none">{group.name}</h1>
        <p className="text-sm text-muted-foreground">
          {group.deadline
            ? state.group.locked
              ? `ננעל ב-${formatWhen(group.deadline)}`
              : `נעילה ב-${formatWhen(group.deadline)}`
            : "עדיין אין שעת נעילה. אפשר לשנות את הניחוש עד שהמנהל יקבע אותה."}
        </p>
        <CopyCode code={group.code} />
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
          />
        ) : (
          <JoinForm code={group.code} />
        )}
      </div>

      <ResultsBoard code={group.code} initial={state} />
    </Shell>
  );
}
