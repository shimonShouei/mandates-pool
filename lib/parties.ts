/**
 * Major lists approved for the 26th Knesset, from the Central Elections
 * Committee list published on gov.il and updated 22 Oct 2026.
 * Forty lists were approved; this is only the competitive core.
 * Confirm the slate before locking bets — רע"ם and the Joint List were
 * still marked conditional in late September, and Blue and White (כן)
 * was listed as not running.
 */
export type SeedParty = {
  name: string;
  ballot: string;
  color: string;
  matchKeys: string[];
};

export const SEED_PARTIES: SeedParty[] = [
  { name: "הליכוד", ballot: "מחל", color: "#1d4e89", matchKeys: ["הליכוד בהנהגת בנימין נתניהו"] },
  { name: "ביחד", ballot: "רק", color: "#0f766e", matchKeys: ["ביחד בראשות נפתלי בנט"] },
  { name: "ישר!", ballot: "דרך", color: "#1e3a5f", matchKeys: ["ישר", "ישר! עם איזנקוט"] },
  { name: "הדמוקרטים", ballot: "אמת", color: "#b42318", matchKeys: ["הדמוקרטים בראשות יאיר גולן"] },
  { name: "ש\"ס", ballot: "שס", color: "#1e3a8a", matchKeys: ["שס", "התאחדות הספרדים"] },
  { name: "יהדות התורה", ballot: "ג", color: "#292524", matchKeys: ["יהדות התורה והשבת"] },
  { name: "עוצמה יהודית", ballot: "ב", color: "#a16207", matchKeys: ["עוצמה יהודית בראשות איתמר בן גביר"] },
  { name: "ישראל ביתנו", ballot: "ל", color: "#0369a1", matchKeys: ["ישראל ביתנו בראשות אביגדור ליברמן"] },
  { name: "הציונות הדתית וזהות", ballot: "ט", color: "#c2410c", matchKeys: ["הציונות הדתית", "זהות"] },
  { name: "רע\"ם", ballot: "עם", color: "#15803d", matchKeys: ["רעם", "הרשימה הערבית המאוחדת"] },
  { name: "הרשימה המשותפת", ballot: "ודם", color: "#9f1239", matchKeys: ["ודם", "חד\"ש תע\"ל"] },
  { name: "המילואימניקים", ballot: "די", color: "#6d28d9", matchKeys: ["המילואימניקים והכלכלית"] },
  { name: "עמך ישראל", ballot: "ך", color: "#92400e", matchKeys: ["עמך ישראל בראשות עופר וינטר"] },
];
