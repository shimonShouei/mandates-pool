import { ImageResponse } from "next/og";
import { rubikBold, shareCard, shareSize } from "@/lib/share-card";

export const alt = "מנדטים, משחק ניחוש המושבים לכנסת";
export const size = shareSize;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    shareCard({
      kicker: "כנסת ה-26",
      title: "מנדטים",
      detail: "120 מושבים. קבוצה של חברים. נעילה בפתיחת הקלפיות.",
    }),
    { ...shareSize, fonts: [{ name: "Rubik", data: await rubikBold(), weight: 700 }] },
  );
}
