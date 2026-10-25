"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyLink({ label, display, path }: { label: string; display: string; path: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div dir="ltr" className="truncate text-sm">
          {display}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-11 shrink-0"
        onClick={async () => {
          const url = path.startsWith("http") ? path : `${window.location.origin}${path}`;
          await navigator.clipboard.writeText(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "הועתק" : "העתקה"}
      </Button>
    </div>
  );
}
