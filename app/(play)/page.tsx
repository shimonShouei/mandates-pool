import Link from "next/link";
import { createPublicGroupAction, goToCode } from "@/app/actions";
import { currentUser } from "@/auth";
import { ActionForm } from "@/components/action-form";
import { LockCountdown } from "@/components/lock-status";
import { InstallHint } from "@/components/pwa-register";
import { Shell } from "@/components/shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SEED_PARTIES } from "@/lib/parties";
import { pollsOpenIso } from "@/lib/time";
import { cn } from "cn";

export default async function HomePage() {
  const user = await currentUser();
  const serverNow = Date.now();
  return (
    <Shell wide>
      <section className="rise-in relative mt-4 overflow-hidden rounded-[2rem] bg-card px-5 py-6 ring-1 ring-border sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -start-10 -top-16 size-48 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -end-8 top-10 size-40 rounded-full bg-accent blur-3xl" />
        <div className="relative">
          <p className="text-sm font-medium text-primary">כנסת ה-26 · 27.10.2026 · נעילה ב-07:00</p>
          <h1 className="mt-2 font-heading text-6xl leading-none sm:text-8xl">מנדטים</h1>
          <p className="mt-3 max-w-xl text-lg leading-relaxed">
            משחק הניחושים לחברים. כל אחד מחלק 120 מושבים, ובסוף רואים מי הכי קרוב. בלי סיסמה, ובלי לחשוף ניחוש אם הקבוצה בחרה להישאר אנונימית.
          </p>
          <div className="mt-5">
            <LockCountdown lockAt={pollsOpenIso()} locked={false} reason="election" serverNow={serverNow} prominent />
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <a href="#open" className={cn(buttonVariants(), "h-12 px-5 text-base")}>
              פתיחת קבוצה
            </a>
            <a href="#join" className={cn(buttonVariants({ variant: "outline" }), "h-12 bg-background px-5 text-base")}>
              יש לי קוד
            </a>
          </div>
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="חלק מהרשימות במשחק">
            {SEED_PARTIES.slice(0, 8).map((party) => (
              <li
                key={party.ballot}
                className="inline-flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium ring-1 ring-border"
              >
                <span className="size-2.5 rounded-full" style={{ background: party.color }} />
                {party.name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {user ? (
          <ActionForm id="open" action={createPublicGroupAction} className="scroll-mt-24 space-y-3 rounded-3xl bg-card p-4 ring-1 ring-border">
            <h2 className="font-heading text-2xl">קבוצה חדשה</h2>
            <div className="space-y-1.5">
              <Label htmlFor="group-name">שם הקבוצה</Label>
              <Input id="group-name" name="name" required minLength={2} maxLength={40} placeholder="למשל חברים מהעבודה" className="h-11" />
            </div>
            <Button type="submit" className="h-11 w-full">
              יצירת קבוצה
            </Button>
            <p className="text-sm text-muted-foreground">החשבון הזה מנהל את הקבוצה. נוצר גם קישור גיבוי, לשמירה בצד.</p>
          </ActionForm>
        ) : (
          <div id="open" className="scroll-mt-24 space-y-3 rounded-3xl bg-card p-4 ring-1 ring-border">
            <h2 className="font-heading text-2xl">קבוצה חדשה</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              כדי לפתוח קבוצה נכנסים עם Google או עם קישור למייל. בלי סיסמה. הניחוש יישאר על החשבון, לא רק בדפדפן הזה.
            </p>
            <Link
              href="/signin?callbackUrl=/"
              className={cn(buttonVariants(), "h-11 w-full")}
            >
              כניסה
            </Link>
          </div>
        )}

        <form id="join" action={goToCode} className="scroll-mt-24 space-y-3 rounded-3xl bg-card p-4 ring-1 ring-border">
          <h2 className="font-heading text-2xl">יש לכם כבר קוד?</h2>
          <div className="space-y-1.5">
            <Label htmlFor="code">קוד הקבוצה</Label>
            <Input
              id="code"
              name="code"
              required
              dir="ltr"
              autoCapitalize="characters"
              placeholder="למשל 7K3M9Q2A"
              className="h-12 text-center text-lg tracking-[0.2em]"
            />
          </div>
          <Button type="submit" variant="outline" className="h-11 w-full">
            כניסה לקבוצה
          </Button>
        </form>
      </div>

      <ol className="mt-8 grid gap-3 sm:grid-cols-3">
        <Step n="1" title="נכנסים לחשבון, ובוחרים כינוי">
          Google או קישור למייל, בלי סיסמה. הכינוי בכל קבוצה הוא מה שרואים בדירוג. המייל נשאר פרטי.
        </Step>
        <Step n="2" title="מחלקים בדיוק 120">
          מספר שלם לכל רשימה. 1 עד 3 מנדטים לא עוברים את אחוז החסימה, אז שם רושמים אפס או לפחות 4.
        </Step>
        <Step n="3" title="הציון הוא מושבים לא במקום">
          הניחושים ננעלים ב-07:00 ביום הבחירות. בדירוג הארצי ובקהל רואים סיכום, לא ניחוש של אדם.
        </Step>
      </ol>

      <InstallHint />

      <p className="mt-10 text-sm text-muted-foreground">
        <Link href="/admin" className="underline-offset-4 hover:underline">
          ניהול האתר
        </Link>
        <span> · תוצאות, רשימות והסכמי עודפים המשותפים לכל הקבוצות</span>
      </p>
    </Shell>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-3xl bg-card p-4 ring-1 ring-border">
      <span className="font-heading text-3xl text-primary">{n}</span>
      <h2 className="mt-1 font-medium">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </li>
  );
}
