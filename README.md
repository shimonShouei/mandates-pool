# מנדטים

ניחוש מושבים לכנסת, בשביל שמעון והחברים. כל משתתף מחלק 120 מנדטים. אחרי הספירה, מי שהכי קרוב לתוצאה מנצח.

הממשק בעברית, מימין לשמאל, ונוח בטלפון.

## איך זה עובד

1. המנהל נכנס עם `ADMIN_SECRET`, יוצר קבוצה, ומעתיק את הקישור.
2. כל חבר נכנס עם הקישור ובוחר כינוי (אפשר שם בדוי). אין סיסמה. הדפדפן שומר אסימון, ורק האסימון הזה יכול לערוך את הניחוש.
3. מחלקים מספרים שלמים שסכומם 120. ערך בין 1 ל-3 מקבל אזהרה: אחוז החסימה הוא 3.25%, ורשימה שלא עוברת אותו מקבלת 0.
4. המנהל קובע שעת נעילה. אחריה אי אפשר לשנות ניחוש.
5. התוצאות נמשכות מאתר ועדת הבחירות המרכזית. אם המשיכה נכשלת, מעלים את דף התוצאות מהדפדפן או מזינים מנדטים ידנית.
6. הדירוג הציבורי מציג רק כינוי, מקום וציון. אף אחד, כולל המנהל, לא רואה את חלוקת המושבים של מישהו אחר. את הפער מול כל מפלגה רואים רק בניחוש שלכם.

המנצח נקבע לפי **מרחק אוקלידי**: שורש הסכום של ריבועי ההפרשים בין הניחוש לתוצאה. נמוך יותר עדיף. בדירוג מופיע גם **סכום הסטיות המוחלטות**, ואפשר למיין לפיו. שתי הפונקציות חיות ב-`lib/scoring.ts`.

## הרצה מקומית

```bash
npm install
cp .env.example .env.local
npm test
npm run dev
```

ערכו את `.env.local` והחליפו את `ADMIN_SECRET`. בלי `DATABASE_URL` האפליקציה שומרת על SQLite ב-`data/mandates.db`.

פתחו את דף הבית, היכנסו ל`/admin`, צרו קבוצה, ושלחו את הקישור.

## משתני סביבה

| משתנה | חובה | משמעות |
| --- | --- | --- |
| `ADMIN_SECRET` | כן | סוד המנהל. לא סיסמה של משתתף. |
| `CRON_SECRET` | בפרודקשן | וורסל שולחת `Authorization: Bearer <CRON_SECRET>` אל הרענון המתוזמן. |
| `DATABASE_URL` | על ורסל | מחרוזת Postgres, למשל Neon או Supabase. מקומית אפשר בלי. |
| `RESULTS_SOURCE_URL` | לא | כתובת חלופית לדף התוצאות, אם רוצים לעקוף את ברירת המחדל. |
| `SQLITE_PATH` | לא | נתיב לקובץ SQLite המקומי. |

## פריסה כך שחברים ייכנסו מכתובת ציבורית

SQLite לא נשמר על ורסל. צריך Postgres.

1. צרו מסד ב-[Neon](https://neon.tech) (יש מסלול חינמי). העתיקו את מחרוזת החיבור **עם ה-pooler**, כולל `sslmode=require`.
2. דחפו את הריפו לגיטהאב, אם עוד אין שם ריפו.
3. ב-[Vercel](https://vercel.com) בחרו Import Project, וחברו את הריפו. הפריימוורק מזוהה כ-Next.js.
4. הגדירו בסביבה של הפרויקט: `ADMIN_SECRET`, `CRON_SECRET`, `DATABASE_URL`.
5. פרסו. הכתובת תהיה מהצורה `https://<project>.vercel.app`.
6. היכנסו אל `https://<project>.vercel.app/admin`, צרו קבוצה, ושלחו את `https://<project>.vercel.app/g/<קוד>`.

`vercel.json` קובע רענון כל חמש דקות ב-`/api/cron/refresh-results`. במסלול Hobby של ורסל המגבלה בפועל היא לרוב פעם ביום. בנוסף, כל פתיחה של הדירוג מרעננת לבד אם הצילום האחרון ישן משלוש דקות, אז ערב הבחירות מספיק שמישהו ישאיר את הדף פתוח.

## רשימת המפלגות

הזרע הוא הרשימות הגדולות **לכנסת ה-26**, לפי רשימת המועמדים שוועדת הבחירות פרסמה ועודכנה ב-22 באוקטובר 2026. אושרו 38 רשימות. כאן נזרעות הגדולות: הליכוד (מחל), ביחד (רק), ישר! (דרך), הדמוקרטים (אמת), ש"ס (שס), יהדות התורה (ג), עוצמה יהודית (ב), ישראל ביתנו (ל), הציונות הדתית וזהות (ט), רע"ם (עם), הרשימה המשותפת (ודם), המילואימניקים (די), עמך ישראל (ך).

צריך לבדוק את הרשימה לפני הנעילה. רע"ם והרשימה המשותפת אושרו בספטמבר על תנאי. כחול לבן (כן) מסומנת באתר הרשמי כרשימה שאינה מתמודדת, ולכן היא לא בזרע. המנהל מוסיף, מוחק ומשנה שמות ומאותיות.

## מאיפה מגיעות התוצאות

נבדק ב-25 באוקטובר 2026, יומיים לפני הבחירות לכנסת ה-26 (27 באוקטובר 2026). התוצאות הסופיות אמורות להתפרסם ברשומות עד 4 בנובמבר 2026.

- `https://votes26.bechirot.gov.il/nationalresults` החזיר 404. אתר התוצאות של הכנסת ה-26 עוד לא עלה.
- `https://cdn-votes26.bechirot.gov.il/` נתקע בלי מענה מהסביבה הזו.
- `https://votes25.bechirot.gov.il/nationalresults` הוא דף התוצאות הסופיות של הכנסת ה-25 (1 בנובמבר 2022). מהסביבה הזו קלאודפרונט החזיר HTTP 202 עם `x-amzn-waf-action: challenge`, בלי גוף של תוצאות.
- הדף עצמו, כשמצליחים לקרוא אותו, הוא **HTML ולא JSON**. יש טבלת סיכום (בעלי זכות בחירה, קולות שהוזנו, שיעור הצבעה, קולות כשרים, קולות פסולים) וטבלת רשימות: שם, אותיות, מנדטים, אחוז, קולות. בכותרת «תוצאות סופיות» הספירה מסומנת כסופית. בדף ארעי בלי עמודת מנדטים מחשבים את המושבים מהקולות.
- לא נמצא פיד JSON ארצי יציב. ב-data.gov.il יש CSV של הוועדה לפי קלפי וליישוב לכנסות 18–25. זה ארכיון סופי, לא ספירה חיה, ולכן הוא לא המקור של ליל הבחירות.

המפרש נבדק מול `fixtures/votes25-national.html`: שחזור הטבלה הרשמית של 2022, 40 רשימות, 4,764,742 קולות כשרים. אם המקור החי חסום גם מורסל, המנהל שומר את דף התוצאות מהדפדפן ומעלה אותו, או מזין מנדטים ידנית. ההזנה הידנית תמיד עובדת, והיא עוצרת את הדריסה האוטומטית עד שלוחצים «ביטול העקיפה».

מיפוי מהמקור אל הרשימות שלנו הוא לפי אותיות הפתק, ואחר כך לפי שם או מילות זיהוי שהמנהל מוסיף. רשימה שעברה את הסף ואין לה שורה אצלנו מופיעה באזהרה, והמושבים שלה עדיין נספרים בתוך ה-120.

### באדר-עופר

אם בדף אין מנדטים, או שהמנהל ביקש לחשב בעצמנו:

1. רשימה מתחת ל-3.25% מכלל הקולות הכשרים יוצאת. ההשוואה היא `votes * 400 >= valid * 13`.
2. המודד הוא החלק השלם של קולות הרשימות שעברו, חלקי 120.
3. כל רשימה מקבלת `floor(קולות / מודד)` לבד.
4. המנדטים שנשארו מחולקים אחד-אחד למי ש-`קולות / (מנדטים + 1)` הכי גבוה. הסכם עודפים מתחרה כזוג (סכום הקולות וסכום המושבים), והמושב שהזוג זוכה בו הולך לשותף עם המנה הגבוהה יותר. שותף מתחת לסף מבטל את ההסכם.

ב-2022 נשארו 7 מנדטים אחרי השלב הראשון. עם ההסכמים שבתוקף (הליכוד–הציונות הדתית, יש עתיד–המחנה הממלכתי, ש"ס–יהדות התורה; העבודה–מרצ בטל כי מרצ נפלה) החישוב משחזר את כל 120 המושבים הרשמיים, כולל 32 לליכוד. בלי ההסכמים יוצא 31 לליכוד ו-5 לעבודה. לכן צריך להזין את הסכמי 2026 לפני ליל הבחירות. הם לא מופיעים בדף התוצאות.

שוויון במנה נשבר לטובת מי שיש לו יותר קולות, ואז לפי מזהה יציב. בחוק שוויון מלא מוכרע בהגרלה. זה לא השפיע על 2022.

אחוז הקולות שנספרו מוצג בנפרד משיעור ההצבעה. כל עוד הוועדה לא סימנה תוצאות סופיות, הדירוג מסומן כארעי.

---

# Mandatim

A Hebrew, right-to-left pool for predicting how the 120 Knesset seats will split. Built for Shimon and friends.

## Rules

Participants join with an invite link and a nickname. A random token in an httpOnly cookie is the only credential, and it can edit only that browser's guess. Guesses are whole numbers totaling 120. Values from 1 to 3 warn that they cannot occur under the 3.25% threshold.

After the admin's deadline, guesses lock. The public leaderboard shows nickname, rank, and score only. Per-party guesses and per-party diffs are returned solely to the participant who owns the token. The admin participant list shows whether a guess totals 120, not the numbers. `GET /api/groups/[code]/leaderboard` is `Cache-Control: private, no-store` and is covered by tests that a caller's payload does not contain anyone else's seat vector.

The winner is the lowest **Euclidean distance** between the guess vector and the actual vector. The leaderboard also shows the **sum of absolute errors**, and can be sorted by it. Both functions are isolated in `lib/scoring.ts`.

## Local

```bash
npm install
cp .env.example .env.local
npm test
npm run dev
```

Without `DATABASE_URL`, data is stored in SQLite at `data/mandates.db`. Set `ADMIN_SECRET` before using `/admin`.

## Deploy so friends have a public URL

1. Create a Postgres database on [Neon](https://neon.tech) or Supabase and copy the pooled connection string (`sslmode=require`).
2. Push this repo to GitHub.
3. Import it on [Vercel](https://vercel.com) as a Next.js app.
4. Set `ADMIN_SECRET`, `CRON_SECRET`, and `DATABASE_URL`. SQLite will not persist on Vercel; the app refuses to boot there without `DATABASE_URL`.
5. Open `https://<project>.vercel.app/admin`, create a group, and share `https://<project>.vercel.app/g/<code>`.

`vercel.json` schedules `/api/cron/refresh-results` every five minutes. Vercel Hobby often only runs crons once a day. Opening the leaderboard also refreshes when the latest snapshot is older than three minutes, which is the practical path on Hobby.

## Parties

The seed is the major lists for the **26th Knesset**, taken from the Central Elections Committee candidate list as updated on 22 October 2026. Thirty-eight lists were approved; only the competitive ones are seeded (Likud, Beyachad, Yashar!, The Democrats, Shas, United Torah Judaism, Otzma Yehudit, Yisrael Beiteinu, Religious Zionism–Zehut, Ra'am, the Joint List, the Miluimnikim list, and Amkha). Check them before locking. Ra'am and the Joint List were conditionally approved in September. Blue and White was marked as not running, so it is not seeded. The admin can add, rename, and remove lists. A list that already has guesses cannot be deleted.

## Official results

Checked on 25 October 2026, two days before the 26th-Knesset election (27 October 2026). Final results are due in Reshumot by 4 November 2026.

- `https://votes26.bechirot.gov.il/nationalresults` returned 404. The 26th-Knesset results host is not up yet.
- `https://cdn-votes26.bechirot.gov.il/` timed out from this environment.
- `https://votes25.bechirot.gov.il/nationalresults` is the final 2022 page. From this environment CloudFront returned HTTP 202 with `x-amzn-waf-action: challenge` and no results body.
- The page itself is **HTML, not a JSON API**: a summary table (eligible voters, ballots, turnout, valid votes, invalid votes) and a list table (name, ballot letters, mandates, percent, votes). A heading of "final results" marks the count final. A provisional page without a mandates column is allocated from the vote counts.
- No stable national JSON feed was found. data.gov.il hosts CEC CSVs per ballot and locality for Knessets 18–25. That is a final archive, not the live count, so it is not the election-night source.

The parser is tested against `fixtures/votes25-national.html`, a reconstruction of the official 2022 national table (40 lists, 4,764,742 valid votes) because the live host could not be downloaded through the WAF. If Vercel is blocked too, the admin uploads the HTML saved from a browser, or enters seats by hand. Manual entry always works and pauses automatic overwrite until "resume" is clicked.

Lists are matched by ballot letters, then by name or admin match-keys. An unmapped list that wins seats is warned about and still counts inside the 120.

### Bader-Ofer

Used when the page has votes but no usable mandate column, or when the admin forces computation:

1. Drop lists under 3.25% of all valid votes (`votes * 400 >= valid * 13`).
2. The measure is `floor(qualifying votes / 120)`.
3. Each qualifying list gets `floor(votes / measure)` on its own.
4. Remaining seats go one at a time to the highest `votes / (seats + 1)`. A surplus agreement competes as one pool; the seat it wins goes to the partner with the higher individual quotient. A partner below the threshold voids the agreement.

For 2022 the first stage left 7 seats. With the agreements that were actually in force (Likud–Religious Zionism, Yesh Atid–National Unity, Shas–United Torah Judaism; Labor–Meretz void because Meretz missed the threshold) the allocator reproduces all official seat totals, including Likud 32. Without agreements Likud gets 31 and Labor 5. Enter the 2026 agreements before election night. They are not on the results page.

Exact ties go to the list with more votes, then a stable id. The statute uses a lottery for a true tie. That did not affect 2022.

"Percent of votes counted" is shown separately from turnout. Until the committee marks the count final, the board is labeled provisional.
