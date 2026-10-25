# תוכנית בדיקות ליום הבחירות

הבדיקות רצות מקומית. `npm test` הוא היחידה והאינטגרציה. `npm run test:e2e` הוא Playwright על בילד מקומי, במובייל ובדסקטופ, בעברית מימין לשמאל. `npm run test:load` בודק עומס קריאה קל מול שרת מקומי. `npx tsx scripts/smoke-prod.ts` הוא קריאה בלבד מול הפרודקשן, בלי ליצור קבוצות או ניחושים.

השעון של הנעילה הוא 27.10.2026 בשעה 07:00 באזור Asia/Jerusalem, כלומר `2026-10-27T05:00:00.000Z` אחרי סיום שעון הקיץ.

## ניחושים

| מקרה | איפה |
| --- | --- |
| סכום חייב להיות בדיוק 120 | `lib/seats.test.ts`, `lib/qa-day.test.ts` |
| שלילי, שבר, טקסט, בוליאני, `0x10`, `1e2` | `lib/qa-day.test.ts` |
| רשימה אחת מעל 120 | `lib/seats.test.ts`, `lib/qa-day.test.ts` |
| הכל אפס | `lib/qa-day.test.ts` |
| רשימה שחסרה בטופס נספרת כאפס | `lib/qa-day.test.ts` |
| רשימה לא מוכרת נדחית | `lib/qa-day.test.ts` |
| כינוי ארוך, אימוג'י, עברית מעורבת באנגלית | `lib/qa-day.test.ts` |
| כינוי כפול, כולל רווחים ואותיות גדולות | `lib/qa-day.test.ts` |
| HTML או SQL בכינוי ובשם קבוצה נשמרים כטקסט, לא מריצים שאילתה | `lib/qa-day.test.ts`, `e2e/public.spec.ts` |
| אזהרה על 1–3 מנדטים, בלי לחסום שמירה | `lib/seats.test.ts` |

## נעילה

| מקרה | איפה |
| --- | --- |
| פתוח שנייה לפני 07:00, נעול בשנייה עצמה ושנייה אחריה | `lib/time.test.ts`, `lib/qa-day.test.ts` |
| האכיפה בשרת לפי השעון שלו, לא לפי שדה מהדפדפן | `lib/qa-day.test.ts` (`savePrediction` מקבל `now` מהשרת) |
| מנהל יכול להקדים נעילה, לא לאחר אותה מעבר לפתיחת הקלפיות | `lib/time.test.ts`, `lib/game.test.ts`, `lib/qa-day.test.ts` |
| שעון קיץ וחורף, כולל המעבר באוקטובר 2026 | `lib/time.test.ts` |

## ציון

| מקרה | איפה |
| --- | --- |
| התאמה מדויקת: שגיאת מושבים 0 | `lib/scoring.test.ts`, `lib/qa-day.test.ts` |
| שוויון נשבר לפי מרחק אוקלידי, ודירוג משותף רק כששניהם שווים | `lib/scoring.test.ts` |
| בונוס חסימה דולק וכבוי | `lib/scoring.test.ts` |
| רשימה מתחת לחסימה מקבלת 0, וניחוש 0 נחשב קריאה נכונה | `lib/qa-day.test.ts`, `lib/results/bader-ofer.test.ts` |
| תוצאה חלקית לא מדרגת | `lib/qa-day.test.ts` |
| התוצאה משתנה במהלך הלילה והדירוג מתעדכן | `lib/qa-day.test.ts` |
| רשימה חדשה בתוצאות שלא במשחק: אין דירוג עד שממפים אותה, ואז ניחוש בלי השורה נספר כאפס | `lib/qa-day.test.ts` |

## באדר-עופר

| מקרה | איפה |
| --- | --- |
| 2022 עם הסכמי עודפים, מול המנדטים הרשמיים | `lib/results/bader-ofer.test.ts`, `fixtures/votes25-national.html` |
| בלי הסכמי עודפים התוצאה שונה | `lib/results/bader-ofer.test.ts` |
| בדיוק 3.25% עובר, קול אחד פחות נופל | `lib/seats.test.ts`, `lib/qa-day.test.ts` |
| הסכם עודפים בטל כשצד אחד מתחת לחסימה | `lib/results/bader-ofer.test.ts`, `lib/qa-day.test.ts` |

## קליטת תוצאות

| מקרה | איפה |
| --- | --- |
| דף ועדת הבחירות חסום, חסר, מקולקל או נתקע: לא זורקים, ושומרים את הצילום האחרון | `lib/results/fetch-official.test.ts`, `lib/qa-day.test.ts` |
| העלאה ידנית ודריסת תוצאה עוצרות רענון אוטומטי | `lib/game.test.ts`, `lib/qa-day.test.ts` |
| רענון לכל היותר פעם בשלוש דקות | `lib/game.test.ts` |
| הודעת הכשל מופיעה בדירוג בלי להחליף את המנדטים | `lib/qa-day.test.ts` |

## קבוצות ופרטיות

| מקרה | איפה |
| --- | --- |
| קבוצה אנונימית: ניחוש של אחר לא מופיע ב-JSON, גם לא לחבר | `lib/game.test.ts`, `lib/visibility.test.ts`, `lib/qa-day.test.ts` |
| מעבר לפתוחה דורש אישור, ולפני הנעילה עדיין לא חושפים | `lib/visibility.test.ts` |
| פתוחה אחרי הנעילה, או עם חשיפה מוקדמת, מראה את הניחוש וההיסטוריה לחברים | `lib/visibility.test.ts` |
| היסטוריית עריכות של הניחוש שלך תמיד אצלך | `lib/visibility.test.ts`, `lib/bet-history.test.ts` |
| קישור הניהול לא מופיע בתשובה הציבורית | `lib/qa-day.test.ts`, `lib/auth-access.test.ts` |
| קבוצה יכולה לצאת מהדירוג הארצי | `lib/qa-day.test.ts`, `lib/crowd.test.ts` |
| קוד לא קיים, כולל מחרוזת שנראית כמו SQL | `lib/qa-day.test.ts`, `e2e/public.spec.ts` |
| המייל לא מופיע בדירוג | `lib/auth-access.test.ts`, `lib/qa-day.test.ts` |

## קופה

הקופה לתצוגה בלבד. האתר לא מעביר כסף.

| מקרה | איפה |
| --- | --- |
| סכום אפס, אגורה, ושבר לא חוקי | `lib/payout.test.ts`, `lib/qa-day.test.ts` |
| 100 וגם 60/30/10 | `lib/payout.test.ts` |
| שוויון מחלק את המקומות, ואגורה עודפת הולכת למזהה המוקדם | `lib/payout.test.ts`, `lib/qa-day.test.ts` |
| כשיש זוכים לכל המקומות, סכום האגורות שווה לקופה | `lib/qa-day.test.ts` |

## קהל

| מקרה | איפה |
| --- | --- |
| מתחת ל-5 ניחושים שלמים אין ממוצע ואין את המספר הבולט | `lib/crowd.test.ts`, `lib/qa-day.test.ts` |
| ב-5 מופיע סיכום בלי וקטור של אדם | `lib/qa-day.test.ts` |
| קבוצה שיוצאת מהדירוג הארצי לא נכנסת לקהל הארצי | `lib/crowd.test.ts` |
| לפני נעילה אפשר לכבות את הקהל, והתשובה בלי המספרים | `lib/crowd.test.ts` |

## חשבון

| מקרה | איפה |
| --- | --- |
| בלי Google ובלי Resend בפרודקשן אין ספקי כניסה, והאתר עולה | `lib/deploy.test.ts`, `scripts/check-auth-boot.ts`, `e2e/public.spec.ts` |
| ניחוש נשאר על החשבון, גם אחרי שמכשיר ישן מנסה לכתוב | `lib/auth-access.test.ts` |
| משתמש אחר לא עורך ניחוש שאינו שלו, ואין שני ניחושים לחשבון בקבוצה | `lib/auth-access.test.ts`, `lib/qa-day.test.ts` |
| קישור הקסם נשאר על המארח של הדפדפן | `lib/public-origin.test.ts` |

## דפים ציבוריים

| מקרה | איפה |
| --- | --- |
| דירוג ארצי ריק, ועמודים כשיש יותר משורה אחת | `lib/qa-day.test.ts`, `e2e/public.spec.ts` |
| 404 בעברית | `e2e/public.spec.ts` |
| `robots.txt` חוסם ניהול, API ודף אישי | `app/robots.ts`, `e2e/public.spec.ts` |
| תמונת Open Graph חוזרת כ-PNG | `e2e/public.spec.ts` |
| עברית, `lang=he`, `dir=rtl`, מובייל ודסקטופ | `e2e/public.spec.ts` |
| מטמון ציבורי קצר על הדירוג, ובלי מטמון על ניחוש פרטי | `lib/free-tier.test.ts`, `npm run test:load` |

## עומס ועשן

`scripts/load-read.mjs` שולח קריאות מקבילות אל `/`, `/board`, `/crowd`, `/scoring`, `/api/leaderboard`, `/api/crowd`. הוא נכשל על 5xx או על דירוג בלי `s-maxage`. מריצים אותו רק מול שרת מקומי.

`scripts/smoke-prod.ts` פונה אל `https://mandates-pool.vercel.app` (או `SMOKE_BASE_URL`) ב-GET בלבד. הוא בודק שהדפים וה-API הציבוריים עונים, שהעברית במקום, ושאין יצירת נתונים.
