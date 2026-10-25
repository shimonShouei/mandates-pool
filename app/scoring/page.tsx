import Link from "next/link";
import { Shell } from "@/components/shell";

export default function ScoringPage() {
  return (
    <Shell>
      <header className="mt-8 space-y-3">
        <h1 className="font-heading text-5xl leading-none">איך מחשבים את הציון</h1>
        <p className="text-lg leading-relaxed">
          אותו חישוב בקבוצה ובדירוג הארצי. נמוך יותר עדיף. בדירוג הארצי ובקבוצה אנונימית רואים ציון, לא את חלוקת המושבים. בקבוצה פתוחה החברים רואים את הניחוש לפי הכלל שנקבע לפני הנעילה.
        </p>
      </header>

      <section className="mt-8 space-y-3">
        <h2 className="font-heading text-3xl">סכום הסטיות</h2>
        <p className="leading-relaxed">
          לכל רשימה מחשבים את ההפרש בין הניחוש לתוצאה, בלי מינוס, ומחברים. אם ניחשתם 32 לליכוד ויצא 30, וניחשתם 8 לש&quot;ס
          ויצא 10, הסכום הוא 4. זה הציון הראשי, לפני בונוס.
        </p>
        <p className="leading-relaxed">
          מושב שעבר מרשימה אחת לאחרת נספר פעמיים: פעם ברשימה שאיבדה אותו, ופעם ברשימה שקיבלה אותו. לכן מחלקים את הסכום
          ב-2 ומציגים <strong>מושבים לא במקום</strong>. בדוגמה: 4 סטיות, כלומר 2 מושבים לא במקום.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-heading text-3xl">שובר שוויון</h2>
        <p className="leading-relaxed">
          אם לשני אנשים אותו ציון, מנצח מי שהמרחק האוקלידי שלו קטן יותר. זה שורש סכום ריבועי ההפרשים. הוא לא מחליף את
          הציון הראשי: מי שסכום הסטיות שלו גדול יותר מפסיד, גם אם המרחק שלו קטן יותר.
        </p>
        <p className="leading-relaxed">
          דוגמה, כשהתוצאה היא 30 מושבים לכל אחת מארבע רשימות. ניחוש של 35, 25, 35, 25 וניחוש של 40, 20, 30, 30 שניהם עם
          20 סטיות, כלומר 10 מושבים לא במקום. הראשון מפוזר יותר ולכן המרחק שלו קטן יותר, והוא מדורג לפני השני. אין כאן
          תיקו.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-heading text-3xl">בונוס על אחוז החסימה</h2>
        <p className="leading-relaxed">
          לכל רשימה בודקים אם ניחשתם נכון אם היא עוברת את אחוז החסימה. בניחוש, 4 מנדטים או יותר אומרים «עוברת», ו-0 עד 3
          אומרים «לא עוברת». בתוצאה הרשמית, כל מספר מושבים גדול מאפס אומר שהרשימה עברה. רשימה לא מקבלת 1, 2 או 3 מושבים.
        </p>
        <p className="leading-relaxed">
          על כל קריאה נכונה מורידים מהציון משקל קטן. ברירת המחדל היא 0.25. מנהל האתר יכול לשנות את המשקל, ואפס מכבה את
          הבונוס לגמרי. הציון הסופי הוא סכום הסטיות, פחות המשקל כפול מספר הקריאות הנכונות.
        </p>
      </section>

      <p className="mt-8 text-sm text-muted-foreground">
        <Link href="/board" className="text-primary underline-offset-4 hover:underline">
          הדירוג הארצי
        </Link>
      </p>
    </Shell>
  );
}
