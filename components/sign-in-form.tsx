"use client";

import { useState, useTransition } from "react";
import { googleSignIn, sendMagicLink } from "@/app/(play)/signin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignInForm({
  callbackUrl,
  google,
  email,
  sent,
  failed,
}: {
  callbackUrl: string;
  google: boolean;
  email: boolean;
  sent: boolean;
  failed: boolean;
}) {
  const [error, setError] = useState<string | null>(failed ? "הקישור לא תקף, או שפג תוקפו. בקשו חדש." : null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-6 space-y-4">
      {google ? (
        <form action={googleSignIn}>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <Button type="submit" className="h-11 w-full">
            המשך עם Google
          </Button>
        </form>
      ) : null}
      {google && email ? <p className="text-center text-sm text-muted-foreground">או</p> : null}
      {email ? (
        <form
          className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          action={(formData) => {
            startTransition(async () => {
              const result = await sendMagicLink(formData);
              if (!result.ok) setError(result.error);
            });
          }}
        >
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <div className="space-y-1.5">
            <Label htmlFor="email">מייל</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" dir="ltr" className="h-11" />
          </div>
          <p className="text-sm text-muted-foreground">בלי סיסמה. נשלח קישור חד-פעמי, בתוקף לשעה.</p>
          {sent ? <p className="text-sm text-primary">אם הכתובת מוכרת לשרת המייל, הקישור בדרך.</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" variant={google ? "outline" : "default"} className="h-11 w-full" disabled={pending}>
            {pending ? "שולחים…" : "שליחת קישור"}
          </Button>
        </form>
      ) : null}
      {!google && !email ? (
        <p className="rounded-xl bg-card px-4 py-3 text-sm ring-1 ring-foreground/10">
          הכניסה עוד לא הוגדרה בשרת. צריך Google או מפתח של Resend.
        </p>
      ) : null}
    </div>
  );
}
