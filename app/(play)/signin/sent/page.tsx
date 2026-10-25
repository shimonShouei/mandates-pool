import { SignInForm } from "@/components/sign-in-form";
import { Shell } from "@/components/shell";
import { recentDevMail } from "@/lib/dev-mail";
import { authModes } from "@/auth";

export default async function MagicLinkSentPage() {
  const modes = authModes();
  const inbox = modes.devInbox ? await recentDevMail() : [];
  return (
    <Shell>
      <header className="mt-8 space-y-3">
        <h1 className="font-heading text-5xl leading-none">הקישור נשלח</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          פתחו את המייל ולחצו על הקישור. הוא חד-פעמי ובתוקף לשעה.
        </p>
      </header>
      <SignInForm callbackUrl="/me" google={false} email={modes.email} sent failed={false} />
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
