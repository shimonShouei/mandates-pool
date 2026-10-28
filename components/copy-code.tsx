"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2">
      <div>
        <div className="text-xs text-muted-foreground">קוד לקבוצה</div>
        <div dir="ltr" className="font-heading text-2xl tracking-[0.18em]">
          {code}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-11"
        onClick={async () => {
          const url = `${window.location.origin}/g/${code}`;
          await navigator.clipboard.writeText(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "הועתק" : "העתקת קישור"}
      </Button>
    </div>
  );
}
