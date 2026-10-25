"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinAction } from "@/app/actions";
import { useLocked } from "@/components/lock-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function JoinForm({
  code,
  lockAt,
  locked,
  serverNow,
}: {
  code: string;
  lockAt: string;
  locked: boolean;
  serverNow: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const lock = useLocked(lockAt, locked, serverNow);
  if (lock.locked) {
    return <p className="rounded-xl bg-card px-4 py-3 text-sm ring-1 ring-foreground/10">ההצטרפות נסגרה. הניחושים נעולים.</p>;
  }

  return (
    <form
      className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
      action={(formData) => {
        startTransition(async () => {
          const result = await joinAction(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="code" value={code} />
      <div className="space-y-1.5">
        <Label htmlFor="alias">כינוי</Label>
        <Input
          id="alias"
          name="name"
          required
          maxLength={24}
          autoComplete="nickname"
          placeholder="שם, או שם בדוי"
          className="h-11 text-base"
        />
        <p className="text-sm text-muted-foreground">
          הכינוי מופיע בדירוג. אפשר שם בדוי. הניחוש עצמו נשאר רק אצלכם.
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "נכנסים…" : "נכנסים למשחק"}
      </Button>
    </form>
  );
}
