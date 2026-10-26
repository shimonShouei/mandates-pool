const HEBREW = /[\u0590-\u05FF\uFB1D-\uFB4F]/;

/** Rubik Bold advance widths, units of a 1000-unit em. Unknown glyphs use 600. */
const ADVANCE: Record<string, number> = {
  " ": 213, ".": 284, ":": 292, "/": 534, "-": 477, "·": 330, "+": 607, "%": 807,
  "0": 680, "1": 497, "2": 650, "3": 659, "4": 683, "5": 646, "6": 651, "7": 573, "8": 677, "9": 641,
  א: 634, ב: 574, ג: 483, ד: 558, ה: 646, ו: 290, ז: 415, ח: 649, ט: 647, י: 282,
  כ: 547, ל: 535, מ: 675, נ: 441, ס: 647, ע: 630, פ: 584, צ: 585, ק: 664, ר: 552,
  ש: 762, ת: 709, ך: 554, ם: 633, ן: 284, ף: 583, ץ: 548, "׳": 264, "״": 485, "־": 400,
  A: 716, B: 704, C: 702, D: 716, E: 639, F: 618, G: 720, H: 745, I: 324, J: 671,
  K: 663, L: 597, M: 828, N: 719, O: 712, P: 676, Q: 712, R: 691, S: 663, T: 630,
  U: 725, V: 693, W: 831, X: 690, Y: 681, Z: 650,
};

/**
 * Satori draws a string from left to right and does not apply the Unicode
 * bidi algorithm. For a Hebrew line, hand it the visual order: Hebrew runs
 * reversed, while Latin, digits, dates and times keep their own order.
 * A line with no Hebrew is returned unchanged.
 */
export function toVisualOrder(text: string): string {
  if (!HEBREW.test(text)) return text;
  const reversed = Array.from(text).reverse().join("");
  return reversed.replace(/[A-Za-z0-9]+(?:[.:/+-][A-Za-z0-9]+)*/g, (run) =>
    Array.from(run).reverse().join(""),
  );
}

export function textWidth(text: string, fontSize: number): number {
  let units = 0;
  for (const char of text) units += ADVANCE[char] ?? 600;
  return (units / 1000) * fontSize;
}

/** Break on spaces in logical order, then convert each line for Satori. */
export function visualLines(text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.split(" ").filter((word) => word.length > 0);
  if (words.length === 0) return [""];
  const logical: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && textWidth(next, fontSize) > maxWidth) {
      logical.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) logical.push(current);
  return logical.map((line) => toVisualOrder(line));
}

export function fontSizeToFit(text: string, maxWidth: number, preferred: number, minimum: number): number {
  let size = preferred;
  while (size > minimum && textWidth(text, size) > maxWidth) size -= 2;
  return size;
}
