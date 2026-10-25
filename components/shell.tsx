import Link from "next/link";
import { currentUser } from "@/auth";

export async function Shell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  const user = await currentUser();
  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,rgba(15,92,86,0.09),transparent_52%)]">
      <div className="h-1.5 bg-[#9c3b2e]" />
      <div className="h-1 bg-primary" />
      <div className={`mx-auto px-4 py-6 pb-28 ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="text-sm font-medium tracking-wide text-primary">
            מנדטים
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
            <Link href="/crowd" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              הקהל
            </Link>
            <Link href="/board" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              הדירוג הארצי
            </Link>
            <Link href={user ? "/me" : "/signin"} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              {user ? "הניחושים שלי" : "כניסה"}
            </Link>
          </div>
        </div>
        {children}
        <footer className="mt-12 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <Link href="/scoring" className="underline-offset-4 hover:underline">
            איך מחשבים את הציון
          </Link>
          <Link href="/crowd" className="underline-offset-4 hover:underline">
            חוכמת ההמונים
          </Link>
        </footer>
      </div>
    </div>
  );
}
