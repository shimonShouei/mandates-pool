import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Rubik } from "next/font/google";
import { ClaimDevice } from "@/components/claim-device";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-sans",
});

const themeScript = `(function(){try{var t=localStorage.getItem("mandatim-theme");var dark=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);}catch(e){}})();`;

export const metadata: Metadata = {
  title: "מנדטים",
  description: "ניחוש מושבים לכנסת ה-26. פותחים קבוצה, והדירוג נקבע לפי מושבים לא במקום.",
  applicationName: "מנדטים",
  robots: { index: true, follow: true },
  appleWebApp: { capable: true, title: "מנדטים", statusBarStyle: "black-translucent" },
  openGraph: {
    title: "מנדטים",
    description: "משחק ניחוש המושבים לכנסת ה-26. 120 מושבים, קבוצה של חברים, נעילה ב-27.10.2026 בשעה 07:00.",
    locale: "he_IL",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1ff" },
    { media: "(prefers-color-scheme: dark)", color: "#160f28" },
  ],
  width: "device-width",
  initialScale: 1,
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" className={rubik.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <PwaRegister />
        <ClaimDevice />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
