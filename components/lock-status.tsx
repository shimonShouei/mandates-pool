"use client";

import { useEffect, useState } from "react";
import { formatWhen } from "@/lib/format";
import type { LockReason } from "@/lib/time";

export function useLocked(lockAt: string, serverLocked: boolean, serverNow: number) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const remainingMs = Date.parse(lockAt) - now;
  return { locked: serverLocked || remainingMs <= 0, remainingMs };
}

export function LockCountdown({
  lockAt,
  locked,
  reason,
  serverNow,
}: {
  lockAt: string;
  locked: boolean;
  reason: LockReason;
  serverNow: number;
}) {
  const state = useLocked(lockAt, locked, serverNow);
  const when = formatWhen(lockAt);

  if (state.locked) {
    return (
      <div className="rounded-xl bg-amber-50 px-4 py-3 text-amber-950 ring-1 ring-amber-200">
        <p className="font-heading text-2xl leading-none">הניחושים נעולים</p>
        <p className="mt-1 text-sm">
          {reason === "manual"
            ? `המנהל נעל את הניחושים ב-${when}, לפני פתיחת הקלפיות.`
            : `הקלפיות נפתחו ב-${when}. אי אפשר להצטרף או לשנות ניחוש.`}
        </p>
      </div>
    );
  }

  const parts = splitRemaining(state.remainingMs);
  return (
    <div className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
      <p className="text-sm">
        {reason === "manual"
          ? `נעילה מוקדמת ב-${when}, לפני פתיחת הקלפיות.`
          : `הניחושים יינעלו אוטומטית ב-${when}, כשהקלפיות נפתחות.`}
      </p>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center" aria-live="polite">
        <Cell value={parts.days} label="ימים" />
        <Cell value={parts.hours} label="שעות" />
        <Cell value={parts.minutes} label="דקות" />
        <Cell value={parts.seconds} label="שניות" />
      </div>
    </div>
  );
}

function Cell({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-muted px-1 py-2">
      <div className="font-heading text-2xl tabular-nums">{String(value).padStart(2, "0")}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function splitRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}
