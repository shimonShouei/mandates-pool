import type { Metadata, Viewport } from "next";
import { Frank_Ruhl_Libre, Heebo } from "next/font/google";
import { ClaimDevice } from "@/components/claim-device";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-sans",
});

const frank = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["500", "700", "800"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "מנדטים",
  description: "ניחוש מושבים לכנסת ה-26. פותחים קבוצה, והדירוג נקבע לפי מושבים לא במקום.",
  applicationName: "מנדטים",
  robots: { index: true, follow: true },
  appleWebApp: { capable: true, title: "מנדטים", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f5c56",
  width: "device-width",
  initialScale: 1,
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${frank.variable}`}>
      <body className="min-h-dvh antialiased">
        <PwaRegister />
        <ClaimDevice />
        {children}
      </body>
    </html>
  );
}
