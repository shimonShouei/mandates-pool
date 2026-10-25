"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/app/actions";

export function ActionForm({
  action,
  children,
  className,
  id,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      id={id}
      className={className}
      action={(formData) => {
        startTransition(async () => {
          const result = await action(formData);
          if (!result.ok) {
            setNotice(null);
            setError(result.error);
            return;
          }
          setError(null);
          setNotice(result.notice ?? null);
          router.refresh();
        });
      }}
    >
      <fieldset disabled={pending} className="min-w-0 space-y-3 border-0 p-0">
        {children}
      </fieldset>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="mt-2 text-sm break-all text-primary">{notice}</p> : null}
    </form>
  );
}
