import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "@/components/site-frame";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "מדיניות פרטיות · מנדטים",
  description: "אילו פרטים מנדטים שומר, למה הם נשמרים, ואיך מבקשים מחיקה.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <SiteFrame signedIn={false}>
      <article className="mt-8 space-y-8">
        <header className="space-y-3">
          <h1 className="font-heading text-5xl leading-none">מדיניות פרטיות</h1>
          <p className="leading-relaxed">
            מנדטים הוא משחק ניחוש מושבים לכנסת ה-26, בין חברים. שמעון מפעיל אותו באופן פרטי, ולא כעסק. עודכן ב-25
            באוקטובר 2026.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="font-heading text-3xl">מה נשמר</h2>
          <ul className="list-disc space-y-2 ps-5 leading-relaxed">
            <li>כתובת דוא״ל, מכניסה עם Google או מקישור למייל. אין סיסמה.</li>
            <li>השם ותמונת הפרופיל שגוגל מוסרת בכניסה.</li>
            <li>אסימוני הגישה שגוגל מחזירה, כדי להשאיר את החשבון מחובר. הם לא מוצגים למשתתפים.</li>
            <li>כינוי שאתם בוחרים בכל קבוצה.</li>
            <li>הניחוש, וכל גרסה קודמת שנשמרה.</li>
            <li>ההשתייכות לקבוצה, וסימון שהמנהל בקבוצה רשם אם ההתערבות שולמה. זה סימון בלבד.</li>
            <li>עוגיית כניסה, ועוגיות במכשיר שמזהות את הניחוש ואת ניהול הקבוצה בדפדפן הזה.</li>
            <li>גרסה מגובבת של כתובת הרשת, בלי הכתובת הגולמית, כדי להגביל פתיחת קבוצות לחמש בשעה.</li>
            <li>Vercel Web Analytics: נתוני גלישה אנונימיים, בלי עוגיות ובלי שם או דוא״ל.</li>
            <li>Vercel Speed Insights: מדדי מהירות טעינה, גם הם בלי עוגיות ובלי שם או דוא״ל.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-3xl">למה</h2>
          <p className="leading-relaxed">כדי להפעיל את המשחק ואת הדירוגים. לא לפרסום, ולא לשום שימוש אחר.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-3xl">למי זה מגיע</h2>
          <p className="leading-relaxed">
            האתר לא מוכר את הפרטים ולא מוסר אותם למפרסמים. Vercel מארח את האתר, ו-Neon בפרנקפורט מחזיק את מסד הנתונים,
            כדי שהאתר יעבוד. שמעון רואה את פרטי החשבון שצריך להפעלה, כולל הדוא״ל.
          </p>
          <p className="leading-relaxed">
            משתתפים אחרים רואים את הכינוי. בקבוצה אנונימית הם לא רואים את חלוקת המושבים. בקבוצה פתוחה החברים רואים
            ניחושים והיסטוריית עריכות לפי הכלל שנקבע לפני הנעילה. הדוא״ל לא מוצג למשתתפים ולא למנהל הקבוצה. הדירוג הארצי
            והקהל הם סיכומים, בלי ניחוש של אדם אחד.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-3xl">כסף</h2>
          <p className="leading-relaxed">
            האתר לא גובה כסף ולא מעביר כסף. סכום ההתערבות הוא תצוגה בלבד, והחברים מסדרים אותו ביניהם.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-3xl">מחיקה ותיקונים</h2>
          <p className="leading-relaxed">
            לבקשת מחיקה של החשבון, הניחושים והכינויים, כתבו אל{" "}
            <a dir="ltr" className="text-primary underline-offset-4 hover:underline" href="mailto:shimon.on5@gmail.com">
              shimon.on5@gmail.com
            </a>{" "}
            מהכתובת שאיתה נכנסתם. מנהל האתר יכול לתקן תוצאות, רשימות והסכמי עודפים כשהנתונים שגויים.
          </p>
          <p className="leading-relaxed">
            <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
              תנאי השימוש
            </Link>
          </p>
        </section>
      </article>
    </SiteFrame>
  );
}
