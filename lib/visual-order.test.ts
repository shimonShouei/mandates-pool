import { describe, expect, it } from "vitest";
import { fontSizeToFit, textWidth, toVisualOrder, visualLines } from "./visual-order";

describe("visual order for Satori", () => {
  it("reverses a Hebrew word so the first letter sits on the right", () => {
    expect(toVisualOrder("מנדטים")).toBe("םיטדנמ");
    expect(toVisualOrder("אחשלי בחשלי")).toBe("ילשחב ילשחא");
    expect(toVisualOrder("הצטרפו למשחק")).toBe("קחשמל ופרטצה");
  });

  it("keeps numbers, dates, times and codes inside a Hebrew line", () => {
    expect(toVisualOrder("הנעילה ב-27.10.2026 בשעה 07:00")).toBe("07:00 העשב 27.10.2026-ב הליענה");
    expect(toVisualOrder("סכום 120 מנדטים")).toBe("םיטדנמ 120 םוכס");
    expect(toVisualOrder("כנסת ה-26")).toBe("26-ה תסנכ");
    expect(toVisualOrder("מחלקים 120 מושבים. הניחוש ננעל ב-07:00.")).toBe(".07:00-ב לעננ שוחינה .םיבשומ 120 םיקלחמ");
  });

  it("leaves Latin, codes, dates and times unchanged when the line has no Hebrew", () => {
    expect(toVisualOrder("EMUVN9UD")).toBe("EMUVN9UD");
    expect(toVisualOrder("27.10.2026")).toBe("27.10.2026");
    expect(toVisualOrder("07:00")).toBe("07:00");
    expect(toVisualOrder("27.10.2026 · 07:00")).toBe("27.10.2026 · 07:00");
    expect(toVisualOrder("")).toBe("");
  });

  it("wraps a long line in logical order before reversing each row", () => {
    const text = "סכום 120 מנדטים ועוד מילים כדי לרדת שורה";
    const lines = visualLines(text, textWidth("סכום 120 מנדטים", 30) + 4, 30);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.map((line) => toVisualOrder(line)).join(" ")).toBe(text);
    expect(lines[0]).toBe(toVisualOrder("סכום 120 מנדטים"));
  });

  it("shrinks a 40-letter title until it fits one row", () => {
    const title = "מ".repeat(40);
    const size = fontSizeToFit(title, 1072, 76, 36);
    expect(size).toBeLessThan(76);
    expect(textWidth(title, size)).toBeLessThanOrEqual(1072);
  });

  it("round-trips, so a second pass restores the logical line", () => {
    const lines = [
      "מנדטים",
      "אחשלי בחשלי",
      "הנעילה ב-27.10.2026 בשעה 07:00",
      "סכום 120 מנדטים",
      "120 מושבים. קבוצה של חברים. נעילה בפתיחת הקלפיות.",
      "EMUVN9UD",
      "קוד EMUVN9UD לקבוצה",
    ];
    for (const line of lines) {
      expect(toVisualOrder(toVisualOrder(line))).toBe(line);
    }
  });
});
