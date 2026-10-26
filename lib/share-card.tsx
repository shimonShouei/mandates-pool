import { readFile } from "node:fs/promises";
import path from "node:path";
import { fontSizeToFit, toVisualOrder, visualLines } from "./visual-order";

export const shareSize = { width: 1200, height: 630 };
const innerWidth = shareSize.width - 128;
const codeWidth = 300;

export async function rubikBold(): Promise<ArrayBuffer> {
  const font = await readFile(path.join(process.cwd(), "assets/fonts/Rubik-Bold.ttf"));
  return font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength) as ArrayBuffer;
}

function Lines({
  text,
  fontSize,
  maxWidth,
  color,
  marginTop = 0,
}: {
  text: string;
  fontSize: number;
  maxWidth: number;
  color: string;
  marginTop?: number;
}) {
  const lines = visualLines(text, maxWidth, fontSize);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginTop }}>
      {lines.map((line, index) => (
        <div
          key={`${index}-${line}`}
          style={{ display: "flex", fontSize, lineHeight: 1.15, color, textAlign: "right", whiteSpace: "nowrap" }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

export function shareCard(input: { kicker: string; title: string; detail: string; code?: string }) {
  const titleSize = fontSizeToFit(input.title, innerWidth, 76, 36);
  const detailWidth = input.code ? innerWidth - codeWidth : innerWidth;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#160f28",
        color: "#fff7fb",
        fontFamily: "Rubik",
        padding: "64px",
        direction: "ltr",
      }}
    >
      <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 26, color: "#d6ff6b" }}>{toVisualOrder("27.10.2026 · 07:00")}</div>
        <div style={{ display: "flex", fontSize: 32, color: "#ff7ab6" }}>{toVisualOrder("מנדטים")}</div>
      </div>
      <div style={{ display: "flex", width: "100%", flexDirection: "column", alignItems: "flex-end" }}>
        <Lines text={input.kicker} fontSize={28} maxWidth={innerWidth} color="#d9c8ff" />
        <Lines text={input.title} fontSize={titleSize} maxWidth={innerWidth} color="#fff7fb" marginTop={12} />
      </div>
      <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ display: "flex", direction: "ltr", fontSize: 40, letterSpacing: 4 }}>{toVisualOrder(input.code ?? "")}</div>
        <Lines text={input.detail} fontSize={30} maxWidth={detailWidth} color="#f3e9ff" />
      </div>
    </div>
  );
}
