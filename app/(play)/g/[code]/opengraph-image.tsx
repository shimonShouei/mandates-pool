import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db";
import { getGroupByCode } from "@/lib/game";
import { rubikBold, shareCard, shareSize } from "@/lib/share-card";

export const alt = "הזמנה לקבוצת ניחושים במנדטים";
export const size = shareSize;
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let name = "קבוצת ניחושים";
  let invite = code.toUpperCase();
  try {
    const group = await getGroupByCode(await getDb(), code);
    if (group) {
      name = group.name;
      invite = group.code;
    }
  } catch {
    /* a generic card still shares */
  }
  return new ImageResponse(
    shareCard({
      kicker: "הצטרפו למשחק",
      title: name,
      detail: "מחלקים 120 מושבים. הניחוש ננעל ב-07:00.",
      code: invite,
    }),
    { ...shareSize, fonts: [{ name: "Rubik", data: await rubikBold(), weight: 700 }] },
  );
}
