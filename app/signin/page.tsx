import { authModes } from "@/auth";
import { SignInForm } from "@/components/sign-in-form";
import { Shell } from "@/components/shell";
import { recentDevMail } from "@/lib/dev-mail";
import { safeNext } from "@/lib/safe-next";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; sent?: string; error?: string }>;
}) {
  const query = await searchParams;
  const callbackUrl = safeNext(query.callbackUrl);
  const modes = authModes();
  const inbox = modes.devInbox ? await recentDevMail() : [];
  return (
    <Shell>
      <header className="mt-8 space-y-3">
        <h1 className="font-heading text-5xl leading-none">כניסה</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          חשבון אחד לכל הקבוצות, מכל מכשיר. הכינוי בכל קבוצה הוא מה שרואים בדירוג. המייל לא מוצג לאף משתתף אחר.
        </p>
      </header>
      <SignInForm
        callbackUrl={callbackUrl}
        google={modes.google}
        email={modes.email}
        sent={query.sent === "1"}
        failed={query.error === "1"}
      />
      {inbox.length > 0 ? (
        <section className="mt-6 space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="font-medium">קישורים מקומיים</h2>
          <p className="text-sm text-muted-foreground">
            אין מפתח Resend בסביבה הזו, אז הקישור מופיע כאן במקום להישלח. בפרודקשן זה לא מוצג.
          </p>
          <ul className="space-y-2">
            {inbox.map((item) => (
              <li key={item.url} className="text-sm">
                <span dir="ltr" className="block text-muted-foreground">
                  {item.email}
                </span>
                <a href={item.url} className="text-primary underline-offset-4 hover:underline">
                  פתיחת הקישור
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Shell>
  );
}
