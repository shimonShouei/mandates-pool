"use client";

import { useState } from "react";
import { setVisibilityAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { exposureLevel } from "@/lib/bet-history";
import type { BetVisibility } from "@/lib/public-state";

export function VisibilityForm({
  code,
  visibility,
  revealBeforeLock,
}: {
  code: string;
  visibility: BetVisibility;
  revealBeforeLock: boolean;
}) {
  const [mode, setMode] = useState<BetVisibility>(visibility);
  const [early, setEarly] = useState(revealBeforeLock);
  const increasing = exposureLevel(mode, mode === "open" && early) > exposureLevel(visibility, revealBeforeLock);

  return (
    <ActionForm action={setVisibilityAction} className="space-y-3">
      <input type="hidden" name="code" value={code} />
      <fieldset className="space-y-2 text-sm">
        <legend className="font-medium">מי רואה את חלוקת המושבים</legend>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="visibility"
            value="anonymous"
            className="mt-1"
            checked={mode === "anonymous"}
            onChange={() => setMode("anonymous")}
          />
          <span>
            אנונימית
            <span className="block text-muted-foreground">המצב של היום. כינוי וציון בלבד, גם אחרי הנעילה.</span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="visibility"
            value="open"
            className="mt-1"
            checked={mode === "open"}
            onChange={() => setMode("open")}
          />
          <span>
            פתוחה
            <span className="block text-muted-foreground">
              אחרי הנעילה חברי הקבוצה רואים את הניחוש המלא של כל אחד, ואת היסטוריית השינויים.
            </span>
          </span>
        </label>
      </fieldset>
      <label className={`flex items-start gap-2 text-sm ${mode === "open" ? "" : "text-muted-foreground"}`}>
        <input
          type="checkbox"
          name="revealBeforeLock"
          value="1"
          className="mt-1"
          checked={mode === "open" && early}
          disabled={mode !== "open"}
          onChange={(event) => setEarly(event.target.checked)}
        />
        <span>להראות את הניחושים גם לפני הנעילה. בלי הסימון, החשיפה מתחילה רק כשהקלפיות נפתחות.</span>
      </label>
      {mode === "open" ? (
        <div className="space-y-2 rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-950 ring-1 ring-amber-200">
          <p className="font-medium">הניחושים ייחשפו לחברי הקבוצה</p>
          <p>
            כל חבר יראה את חלוקת המושבים של האחרים, ומתי היא השתנתה. הדירוג הארצי וחוכמת ההמונים נשארים סיכום בלי ניחוש
            של אדם. אחרי הנעילה אי אפשר לחזור לאנונימיות, כדי שמי שניחש ידע את הכלל מראש.
          </p>
          {mode === "open" && early ? <p>סימנתם חשיפה גם לפני הנעילה. הניחוש גלוי לחברים מיד אחרי השמירה.</p> : null}
        </div>
      ) : null}
      {increasing ? (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="confirmOpen" value="1" required className="mt-1" />
          <span>קראתי את האזהרה. הכלל הזה נקבע לפני הנעילה, והחברים יידעו שהניחושים נפתחים.</span>
        </label>
      ) : null}
      <Button type="submit" className="h-11">
        שמירת כלל החשיפה
      </Button>
    </ActionForm>
  );
}
