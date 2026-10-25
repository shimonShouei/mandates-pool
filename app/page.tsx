import Link from "next/link";
import { createPublicGroupAction, goToCode } from "@/app/actions";
import { currentUser } from "@/auth";
import { ActionForm } from "@/components/action-form";
import { InstallHint } from "@/components/pwa-register";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function HomePage() {
  const user = await currentUser();
  return (
    <Shell>
      <header className="mt-8 space-y-3">
        <p className="text-sm text-muted-foreground">הבחירות לכנסת ה-26 · 27 באוקטובר 2026</p>
        <h1 className="font-heading text-6xl leading-none">מנדטים</h1>
        <p className="text-lg leading-relaxed">
          פותחים קבוצה, כל אחד מחלק 120 מושבים, ואחרי הספירה רואים מי הכי קרוב. אף אחד לא רואה איך האחרים חילקו.
        </p>
      </header>

      {user ? (
        <ActionForm action={createPublicGroupAction} className="mt-8 space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="font-heading text-2xl">קבוצה חדשה</h2>
          <div className="space-y-1.5">
            <Label htmlFor="group-name">שם הקבוצה</Label>
            <Input id="group-name" name="name" required minLength={2} maxLength={40} placeholder="למשל חברים מהעבודה" className="h-11" />
          </div>
          <Button type="submit" className="h-11 w-full">
            יצירת קבוצה
          </Button>
          <p className="text-sm text-muted-foreground">
            החשבון הזה מנהל את הקבוצה. נוצר גם קישור גיבוי, לשמירה בצד.
          </p>
        </ActionForm>
      ) : (
        <div className="mt-8 space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="font-heading text-2xl">קבוצה חדשה</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            כדי לפתוח קבוצה נכנסים עם Google או עם קישור למייל. בלי סיסמה. הניחוש יישאר על החשבון, לא רק בדפדפן הזה.
          </p>
          <Link href="/signin?callbackUrl=/" className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground">
            כניסה
          </Link>
        </div>
      )}

      <form action={goToCode} className="mt-4 space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="space-y-1.5">
          <Label htmlFor="code">יש לכם כבר קוד?</Label>
          <Input
            id="code"
            name="code"
            required
            dir="ltr"
            autoCapitalize="characters"
            placeholder="למשל 7K3M9Q2A"
            className="h-11 text-center text-lg tracking-[0.2em]"
          />
        </div>
        <Button type="submit" variant="outline" className="h-11 w-full">
          כניסה לקבוצה
        </Button>
      </form>

      <p className="mt-4 text-sm">
        <Link href="/board" className="text-primary underline-offset-4 hover:underline">
          הדירוג הארצי, מכל הקבוצות
        </Link>
        <span className="text-muted-foreground"> · </span>
        <Link href="/scoring" className="text-primary underline-offset-4 hover:underline">
          איך מחשבים את הציון
        </Link>
        <span className="text-muted-foreground"> · </span>
        <Link href="/crowd" className="text-primary underline-offset-4 hover:underline">
          חוכמת ההמונים
        </Link>
      </p>

      <ol className="mt-8 space-y-4">
        <Step n="1" title="נכנסים לחשבון, ובוחרים כינוי">
          Google או קישור למייל, בלי סיסמה. הכינוי בכל קבוצה הוא מה שרואים בדירוג. המייל נשאר פרטי.
        </Step>
        <Step n="2" title="מחלקים בדיוק 120">
          מספר שלם לכל רשימה. 1 עד 3 מנדטים לא עוברים את אחוז החסימה, אז שם רושמים אפס או לפחות 4.
        </Step>
        <Step n="3" title="הציון הוא מושבים לא במקום">
          הניחושים ננעלים ב-07:00 ביום הבחירות, כשהקלפיות נפתחות. בדירוג רואים כינוי, קבוצה וכמה מושבים לא במקום. לא את הניחוש עצמו.
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
    <li className="flex gap-3">
      <span className="font-heading text-2xl text-primary">{n}</span>
      <div>
        <h2 className="font-medium">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}
