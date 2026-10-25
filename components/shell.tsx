import Link from "next/link";
import { currentUser } from "@/auth";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/crowd", label: "הקהל" },
  { href: "/board", label: "הדירוג" },
  { href: "/scoring", label: "הציון" },
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

export async function Shell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  const user = await currentUser();
  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_55%)]">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-3">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="font-heading text-xl leading-none text-primary">
              מנדטים
            </Link>
            <div className="flex items-center gap-1 sm:hidden">
              <AccountLink signedIn={Boolean(user)} />
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
              <AccountLink signedIn={Boolean(user)} />
              <ThemeToggle />
            </span>
          </nav>
        </div>
      </header>
      <div className={`mx-auto px-4 py-6 pb-28 ${wide ? "max-w-3xl" : "max-w-lg"}`}>{children}</div>
    </div>
  );
}
