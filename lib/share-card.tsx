import { readFile } from "node:fs/promises";
import path from "node:path";

export const shareSize = { width: 1200, height: 630 };

export async function rubikBold(): Promise<ArrayBuffer> {
  const font = await readFile(path.join(process.cwd(), "assets/fonts/Rubik-Bold.ttf"));
  return font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength) as ArrayBuffer;
}

export function shareCard(input: { kicker: string; title: string; detail: string; code?: string }) {
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
        direction: "rtl",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 32, color: "#ff7ab6" }}>מנדטים</div>
        <div style={{ display: "flex", fontSize: 26, color: "#d6ff6b" }}>27.10.2026 · 07:00</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 28, color: "#d9c8ff" }}>{input.kicker}</div>
        <div style={{ display: "flex", fontSize: 76, lineHeight: 1.08, marginTop: 12 }}>{input.title}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ display: "flex", fontSize: 30, color: "#f3e9ff" }}>{input.detail}</div>
        <div style={{ display: "flex", direction: "ltr", fontSize: 40, letterSpacing: 4 }}>{input.code ?? ""}</div>
      </div>
    </div>
  );
}
