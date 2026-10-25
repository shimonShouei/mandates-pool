import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/crowd", label: "הקהל" },
  { href: "/board", label: "הדירוג" },
  { href: "/scoring", label: "הציון" },
];

const legal = [
  { href: "/privacy", label: "מדיניות פרטיות" },
  { href: "/terms", label: "תנאי שימוש" },
];

function AccountLink({ signedIn }: { signedIn: boolean }) {
  return (
    <Link
      href={signedIn ? "/me" : "/signin"}
      className="rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/85"
    >
      {signedIn ? "שלי" : "כניסה"}
    </Link>
  );
}

export function SiteFrame({
  children,
  signedIn,
  wide = false,
}: {
  children: React.ReactNode;
  signedIn: boolean;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_55%)]">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-3">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="font-heading text-xl leading-none text-primary">
              מנדטים
            </Link>
            <div className="flex items-center gap-1 sm:hidden">
              <AccountLink signedIn={signedIn} />
              <ThemeToggle />
            </div>
          </div>
          <nav className="mt-2 flex items-center gap-1 sm:mt-0" aria-label="ראשי">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full px-2.5 py-2 text-sm font-medium text-foreground/80 transition hover:bg-muted hover:text-foreground sm:px-3"
              >
                {link.label}
              </Link>
            ))}
            <span className="ms-1 hidden items-center gap-1 sm:flex">
              <AccountLink signedIn={signedIn} />
              <ThemeToggle />
            </span>
          </nav>
        </div>
      </header>
      <div className={`mx-auto w-full flex-1 px-4 py-6 ${wide ? "max-w-3xl" : "max-w-lg"}`}>{children}</div>
      <footer className="border-t border-border/80">
        <nav
          aria-label="מידע"
          className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 text-sm text-muted-foreground"
        >
          {legal.map((link) => (
            <Link key={link.href} href={link.href} className="underline-offset-4 hover:text-foreground hover:underline">
              {link.label}
            </Link>
          ))}
          <a
            href="mailto:shimon.on5@gmail.com"
            dir="ltr"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            shimon.on5@gmail.com
          </a>
        </nav>
      </footer>
    </div>
  );
}
