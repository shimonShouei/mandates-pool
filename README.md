# מנדטים

ניחוש מושבים לכנסת. כל אחד פותח קבוצה, והמשתתפים מחלקים 120 מנדטים. אחרי הספירה, מי שהכי קרוב לתוצאה מנצח.

הממשק בעברית, מימין לשמאל, ונוח בטלפון. אפשר להוסיף את האתר למסך הבית. אין אפליקציה בחנות.

## איך זה עובד

1. בדף הבית נותנים שם לקבוצה. מי שפתח אותה מקבל קישור ניהול פרטי, שנשמר בדפדפן. הסוד `ADMIN_SECRET` לא נדרש לניהול קבוצה.
2. כל חבר נכנס עם הקישור ובוחר כינוי (אפשר שם בדוי). אין סיסמה. הדפדפן שומר אסימון, ורק האסימון הזה יכול לערוך את הניחוש.
3. מחלקים מספרים שלמים שסכומם 120. ערך בין 1 ל-3 מקבל אזהרה: אחוז החסימה הוא 3.25%, ורשימה שלא עוברת אותו מקבלת 0.
4. הניחושים ננעלים אוטומטית ב-07:00 שעון ישראל ביום הבחירות (27 באוקטובר 2026 לקבוצה חדשה), כשהקלפיות נפתחות. מנהל הקבוצה יכול להקדים את הנעילה, לא לאחר אותה. אחרי הנעילה אי אפשר להצטרף או לשנות ניחוש.
5. התוצאות, רשימת המפלגות והסכמי העודפים משותפים לכל הקבוצות. אותם מושך או מזין רק מי שנכנס עם `ADMIN_SECRET` אל `/admin`. אם המשיכה מוועדת הבחירות נכשלת, מעלים את דף התוצאות מהדפדפן או מזינים מנדטים ידנית.
6. הדירוג של הקבוצה מציג רק כינוי, מקום וציון. הדירוג הארצי ב-`/board` מוסיף את שם הקבוצה ואת המקום של אותו אדם בתוך הקבוצה שלו. אף אחד לא רואה את חלוקת המושבים של מישהו אחר. מנהל קבוצה יכול להוציא את הקבוצה מהדירוג הארצי. ברירת המחדל היא להופיע.

הציון הראשי הוא **סכום הסטיות המוחלטות**: לכל רשימה לוקחים את ההפרש בלי מינוס ומחברים. מושב שעבר מרשימה לרשימה נספר פעמיים, ולכן בדירוג מוצג גם החצי, **מושבים לא במקום**. נמוך יותר עדיף. אם לשני אנשים אותו ציון, שוברים תיקו לפי מרחק אוקלידי. הוא לא מחליף את הציון הראשי.

על כל רשימה שניחשו נכון אם היא עוברת את אחוז החסימה מורידים משקל קטן. בניחוש, 4 ומעלה אומר «עוברת» ו-0 עד 3 אומר «לא». בתוצאה, כל מספר מושבים גדול מאפס אומר שהרשימה עברה. ברירת המחדל היא 0.25, ומנהל האתר יכול לשנות את המשקל או לשים 0 כדי לכבות את הבונוס. אותו ציון בקבוצה ובדירוג הארצי. הסבר בעברית פשוטה נמצא ב-`/scoring`. הפונקציות חיות ב-`lib/scoring.ts`.

מנהל קבוצה יכול לקבוע השתתפות בשקלים וחלוקה (ברירת המחדל: המנצח לוקח הכל, או למשל 60/30/10). תיקו מחלק שווה בשווה את המקומות שהתיקו תופס. בדירוג הקבוצה מופיעים גודל הקופה והסכום שמגיע לכל אחד מהראשונים. זה תצוגה בלבד: האתר לא גובה, לא מחזיק ולא מעביר כסף, והחברים מסדרים את התשלום ביניהם. סימון מי שילם גלוי רק למנהל הקבוצה, ולא מופיע בדירוג הארצי.

## הרצה מקומית

```bash
npm install
cp .env.example .env.local
npm test
npm run dev
```

ערכו את `.env.local` והחליפו את `ADMIN_SECRET`. בלי `DATABASE_URL` האפליקציה שומרת על SQLite ב-`data/mandates.db`.

פתחו את דף הבית וצרו קבוצה. הקישור לחברים הוא `/g/<קוד>`. את קישור הניהול שומרים בנפרד. `ADMIN_SECRET` נדרש רק ל-`/admin`.

יצירת קבוצה מוגבלת לחמש קבוצות בשעה מאותה כתובת רשת. שם קבוצה הוא 2 עד 40 תווים.

## הוספה למסך הבית

בכרום או באדג' מופיע «התקנת אפליקציה» או «הוספה למסך הבית». באייפון, בספארי: שיתוף ואז «הוספה למסך הבית». האתר נפתח בעברית מימין לשמאל, בלי חלון הדפדפן. זה אתר (PWA), לא אפליקציה מחנות.

## משתני סביבה

| משתנה | חובה | משמעות |
| --- | --- | --- |
| `ADMIN_SECRET` | לניהול האתר | סוד לתוצאות, לרשימות, להסכמי העודפים ולמשקל בונוס החסימה. לא נדרש כדי לפתוח קבוצה. |
| `CRON_SECRET` | בפרודקשן | וורסל שולחת `Authorization: Bearer <CRON_SECRET>` אל הרענון היומי. |
| `DATABASE_URL` | על ורסל | מחרוזת Postgres. כתובת Neon בלי `-pooler` מוחלפת אוטומטית ל-pooler. |
| `DATABASE_DIRECT` | לא | `1` מבטל את ההחלפה ל-pooler. |
| `RESULTS_SOURCE_URL` | לא | כתובת חלופית לדף התוצאות, אם רוצים לעקוף את ברירת המחדל. |
| `SQLITE_PATH` | לא | נתיב לקובץ SQLite המקומי. |

## פריסה כך שחברים ייכנסו מכתובת ציבורית

SQLite לא נשמר על ורסל. צריך Postgres.

1. צרו מסד ב-[Neon](https://neon.tech) במסלול החינמי. העתיקו מחרוזת חיבור עם `sslmode=require`. אפשר את הכתובת הרגילה: האפליקציה מוסיפה `-pooler` בעצמה, אלא אם `DATABASE_DIRECT=1`.
2. דחפו את הריפו לגיטהאב, אם עוד אין שם ריפו.
3. ב-[Vercel](https://vercel.com) בחרו Import Project, וחברו את הריפו. הפריימוורק מזוהה כ-Next.js. מסלול Hobby מספיק.
4. הגדירו בסביבה של הפרויקט: `ADMIN_SECRET`, `CRON_SECRET`, `DATABASE_URL`.
5. פרסו. הכתובת תהיה מהצורה `https://<project>.vercel.app`.
6. שלחו את `https://<project>.vercel.app`. כל אחד פותח קבוצה מדף הבית. `https://<project>.vercel.app/board` הוא הדירוג הארצי. `https://<project>.vercel.app/admin` מיועד רק למי שמחזיק ב-`ADMIN_SECRET`.

## מסלול חינמי בליל הבחירות

האתר בנוי ל-Vercel Hobby ול-Neon החינמי, בלי להסתמך על cron תכוף.

- Hobby מריץ משימה מתוזמנת בערך פעם ביום. `vercel.json` קובע `0 3 * * *` על `/api/cron/refresh-results`. הרענון האמיתי הוא לפי דרישה.
- פתיחת הדירוג הארצי (`GET /api/leaderboard`) או דירוג הקבוצה הציבורי (`GET /api/groups/[code]/standings`) בודקת אם מותר למשוך. מנעול על `last_fetch_attempt_at` מבטיח משיכה אחת לכל היותר בכל שלוש דקות, לכל המבקרים יחד.
- כל כתובת מקבלת עד 4 שניות, והלולאה נעצרת אחרי 7 שניות. כך הרענון נכנס במגבלת הפונקציה של Hobby, בערך 10 שניות.
- הדירוג של כל קבוצה והדירוג הארצי מחושבים פעם אחת כשמשתנים התוצאה, הניחושים, משקל הבונוס או רשימת הקבוצות, ונשמרים ב-`board_cache`. אחר כך קוראים את הצילום.
- התשובות הציבוריות נשלחות עם `Cache-Control: public, max-age=0, s-maxage=30, stale-while-revalidate=120`. הדפדפן לא שומר אותן. ה-CDN יכול להחזיק חצי דקה, ועוד שתי דקות של עותק ישן בזמן שהוא מרענן.
- הניחוש הפרטי הוא `GET /api/groups/[code]/me` עם `private, no-store`. הוא לא מושך את ועדת הבחירות, והדף מבקש אותו רק כשחותמת התוצאות משתנה.
- החיבור ל-Neon הוא `@neondatabase/serverless`, חיבור אחד לכל מופע (`max: 1`), דרך ה-pooler. כך לא אוכלים את מכסת החיבורים הישירים של המסלול החינמי.
- קיבולת צפויה: עשרות קבוצות ואלפי ניחושים שלמים הם מעבר אחד בזיכרון. הבדיקה מריצה 120 ניחושים בנוחות. מה שיקר הוא המשיכה מוועדת הבחירות, והיא מוגבלת לפעם בשלוש דקות לכל האתר. בליל הבחירות רוב הקריאות לדירוג נענות מה-CDN ומהצילום שבמסד.

## רשימת המפלגות

הזרע הוא הרשימות הגדולות **לכנסת ה-26**, לפי רשימת המועמדים שוועדת הבחירות פרסמה ועודכנה ב-22 באוקטובר 2026. אושרו 38 רשימות. כאן נזרעות הגדולות: הליכוד (מחל), ביחד (רק), ישר! (דרך), הדמוקרטים (אמת), ש"ס (שס), יהדות התורה (ג), עוצמה יהודית (ב), ישראל ביתנו (ל), הציונות הדתית וזהות (ט), רע"ם (עם), הרשימה המשותפת (ודם), המילואימניקים (די), עמך ישראל (ך).

צריך לבדוק את הרשימה לפני הנעילה. רע"ם והרשימה המשותפת אושרו בספטמבר על תנאי. כחול לבן (כן) מסומנת באתר הרשמי כרשימה שאינה מתמודדת, ולכן היא לא בזרע. מנהל האתר מוסיף, מוחק ומשנה שמות ומאותיות. השינוי חל על כל הקבוצות.

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

A Hebrew, right-to-left site for predicting how the 120 Knesset seats will split. Anyone can open a named group. It is an installable site (add to home screen), not an app-store app.

## Rules

The homepage creates a group. The creator becomes that group's admin through a private link stored in an httpOnly cookie. `ADMIN_SECRET` is only for the shared official results, the party list, and surplus agreements. Those are the same for every group.

Participants join with an invite link and a nickname. A random token in an httpOnly cookie is the only credential, and it can edit only that browser's guess. Guesses are whole numbers totaling 120. Values from 1 to 3 warn that they cannot occur under the 3.25% threshold.

Guesses lock automatically at 07:00 Asia/Jerusalem on election day, when polling stations open. A new group defaults to 27 October 2026. The group admin can set an earlier lock, and cannot keep guesses open past polls opening. The clock follows Israel daylight saving time. After the lock, joining and editing are rejected on the server.

A group's board shows nickname, rank, and score only. The national board at `/board` adds the group name and that person's rank inside their own group. It is paginated (40 rows). Groups are included unless their admin opts out. Per-party guesses are never on a public payload. `GET /api/leaderboard` and `GET /api/groups/[code]/standings` return public fields with a short CDN cache. `GET /api/groups/[code]/me` is the private bet and is `Cache-Control: private, no-store`.

Public creation allows 5 new groups per hour per network address. A group name is 2 to 40 characters.

The primary score is the **sum of absolute seat errors**. A seat that moves from one list to another is counted twice, so the boards also show half of that sum as **seats placed wrong**. Lower is better. Euclidean distance breaks ties only. It does not replace the primary score.

A small bonus is subtracted for each party whose pass or fail of the electoral threshold was called correctly. A guess of 4 or more means “passes”; 0–3 means “fails”. Any positive official seat total means the list passed. The default weight is 0.25. The site admin can change it, and 0 turns the bonus off. Group boards and the national board use the same score. A plain-Hebrew explanation is at `/scoring`. The functions live in `lib/scoring.ts`.

A group admin can set a buy-in in shekels and a payout split (winner takes all by default, or for example 60/30/10). A tie splits the places it occupies evenly. The group board shows the pot and what each top finisher is due. That is display only: the site never collects, holds, or transfers money, and friends settle privately. A paid mark is visible only to the group admin and is not on the national board.

## Local

```bash
npm install
cp .env.example .env.local
npm test
npm run dev
```

Without `DATABASE_URL`, data is stored in SQLite at `data/mandates.db`. Open the homepage to create a group. Set `ADMIN_SECRET` before using `/admin`.

Install from Chrome or Edge with “Install app” / “Add to home screen”. On iPhone, use Safari’s Share sheet and “Add to Home Screen”. The installed site stays Hebrew and right-to-left.

## Deploy so friends have a public URL

1. Create a Postgres database on the [Neon](https://neon.tech) free plan and copy a connection string with `sslmode=require`. A host without `-pooler` is rewritten to the pooler unless `DATABASE_DIRECT=1`.
2. Push this repo to GitHub.
3. Import it on [Vercel](https://vercel.com) as a Next.js app. The Hobby plan is enough.
4. Set `ADMIN_SECRET`, `CRON_SECRET`, and `DATABASE_URL`. SQLite will not persist on Vercel; the app refuses to boot there without `DATABASE_URL`.
5. Share `https://<project>.vercel.app`. People create their own groups there. `/board` is the national leaderboard. `/scoring` explains the score in Hebrew. `/admin` is only for the `ADMIN_SECRET` holder.

## Free tier on election night

The app is meant to run on Vercel Hobby and Neon’s free plan, without a frequent cron.

- Hobby runs a scheduled job about once a day. `vercel.json` sets `0 3 * * *` on `/api/cron/refresh-results`. Freshness comes from on-demand refresh.
- Opening the national board (`GET /api/leaderboard`) or a public group board (`GET /api/groups/[code]/standings`) checks a lock on `last_fetch_attempt_at`. The Central Elections Committee is fetched at most once every three minutes, across all visitors.
- Each candidate URL gets 4 seconds, and the loop stops after 7 seconds, inside Hobby’s function limit of about 10 seconds.
- Group boards and the national board are computed once per change of results, guesses, bonus weight, or group list, and stored in `board_cache`. Later reads serve that snapshot.
- Public responses use `Cache-Control: public, max-age=0, s-maxage=30, stale-while-revalidate=120`. Browsers do not keep them. The CDN may keep them for 30 seconds, plus two minutes of a stale copy while it refreshes.
- A person’s own bet is `GET /api/groups/[code]/me` with `private, no-store`. That route does not fetch the committee, and the page asks for it only when the results timestamp changes.
- Neon uses `@neondatabase/serverless` with one connection per instance (`max: 1`) through the pooler, so the free plan’s direct-connection quota stays unused.
- Expected capacity: dozens of groups and thousands of complete guesses are one in-memory pass. The test suite scores 120 guesses comfortably. The expensive step is the committee fetch, and that is limited to once every three minutes for the whole site. On election night most leaderboard reads are answered by the CDN and the stored snapshot.

## Parties

The seed is the major lists for the **26th Knesset**, taken from the Central Elections Committee candidate list as updated on 22 October 2026. Thirty-eight lists were approved; only the competitive ones are seeded (Likud, Beyachad, Yashar!, The Democrats, Shas, United Torah Judaism, Otzma Yehudit, Yisrael Beiteinu, Religious Zionism–Zehut, Ra'am, the Joint List, the Miluimnikim list, and Amkha). Check them before locking. Ra'am and the Joint List were conditionally approved in September. Blue and White was marked as not running, so it is not seeded. The site admin can add, rename, and remove lists, and the change applies to every group. A list that already has guesses cannot be deleted.

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
