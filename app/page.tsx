import Link from "next/link";
import { goToCode } from "@/app/actions";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function HomePage() {
  return (
    <Shell>
      <header className="mt-8 space-y-3">
        <p className="text-sm text-muted-foreground">הבחירות לכנסת ה-26 · 27 באוקטובר 2026</p>
        <h1 className="font-heading text-6xl leading-none">מנדטים</h1>
        <p className="text-lg leading-relaxed">
          כל אחד מחלק 120 מושבים. אחרי הספירה, מי שהכי קרוב לתוצאה מנצח. אף אחד לא רואה איך האחרים חילקו.
        </p>
      </header>

      <form action={goToCode} className="mt-8 space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="space-y-1.5">
          <Label htmlFor="code">קוד שהגיע מהקבוצה</Label>
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
        <Button type="submit" className="h-11 w-full">
          כניסה
        </Button>
      </form>

      <ol className="mt-8 space-y-4">
        <Step n="1" title="נכנסים עם כינוי">
          בלי סיסמה. הקישור והכינוי מספיקים, והדפדפן זוכר שזה הניחוש שלכם.
        </Step>
        <Step n="2" title="מחלקים בדיוק 120">
          מספר שלם לכל רשימה. 1 עד 3 מנדטים לא עוברים את אחוז החסימה, אז שם רושמים אפס או לפחות 4.
        </Step>
        <Step n="3" title="המרחק קובע">
          הניחושים ננעלים ב-07:00 ביום הבחירות, כשהקלפיות נפתחות. הדירוג מציג כינוי וציון בלבד.
        </Step>
      </ol>

      <p className="mt-10 text-sm text-muted-foreground">
        <Link href="/admin" className="underline-offset-4 hover:underline">
          כניסת מנהל
        </Link>
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
