"use client";

import { useEffect } from "react";
import { claimGroupAdmin } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";

export function ClaimAdmin({ code, token }: { code: string; token: string }) {
  useEffect(() => {
    const form = document.getElementById("claim-admin");
    if (form instanceof HTMLFormElement) form.requestSubmit();
  }, []);

  return (
    <ActionForm id="claim-admin" action={claimGroupAdmin} className="mt-6 space-y-3">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-muted-foreground">שומרים את קישור הניהול בדפדפן הזה.</p>
      <Button type="submit" className="h-11">
        כניסה לניהול
      </Button>
    </ActionForm>
  );
}
