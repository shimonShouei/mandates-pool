import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "@/components/site-frame";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "תנאי שימוש · מנדטים",
  description: "הכללים לשימוש במנדטים: משחק בין חברים, בלי גביית כסף ובלי אחריות לתוצאות.",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <SiteFrame signedIn={false}>
      <article className="mt-8 space-y-8">
        <header className="space-y-3">
          <h1 className="font-heading text-5xl leading-none">תנאי שימוש</h1>
          <p className="leading-relaxed">
            מנדטים הוא משחק פרטי ולא מסחרי, שמפעיל שמעון. מנחשים איך יתחלקו 120 המושבים של כנסת ה-26, בקבוצה של חברים.
            הנעילה ביום הבחירות בשעה 07:00. אחריה אי אפשר לשנות ניחוש. עודכן ב-25 באוקטובר 2026.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="font-heading text-3xl">אין אחריות</h2>
          <p className="leading-relaxed">
            האתר ניתן כמו שהוא. אין התחייבות שהוא יהיה זמין, מדויק או שלם. התוצאות עלולות להתעכב או להיות שגויות. מנהל
            האתר רשאי לתקן נתונים, רשימות, הסכמים וניחושים כשצריך כדי שהמשחק יתנהל.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-3xl">כסף</h2>
          <p className="leading-relaxed">
            האתר לא גובה כסף ולא מעביר כסף. סכום שמופיע בקבוצה הוא תצוגה בלבד, בין החברים.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-3xl">פרטיות בקבוצה</h2>
          <p className="leading-relaxed">
            כל קבוצה בוחרת אם הניחושים אנונימיים או פתוחים לחברים. בקבוצה אנונימית רואים כינוי וציון, בלי חלוקת המושבים.
            בקבוצה פתוחה החברים רואים ניחושים והיסטוריית עריכות לפי הכלל שנקבע לפני הנעילה. הדוא״ל לא מוצג.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-3xl">מחיקה</h2>
          <p className="leading-relaxed">
            בקשה למחיקת חשבון:{" "}
            <a dir="ltr" className="text-primary underline-offset-4 hover:underline" href="mailto:shimon.on5@gmail.com">
              shimon.on5@gmail.com
            </a>
            .
          </p>
          <p className="leading-relaxed">
            <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
              מדיניות הפרטיות
            </Link>
          </p>
        </section>
      </article>
    </SiteFrame>
  );
}
