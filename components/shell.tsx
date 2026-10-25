import Link from "next/link";

export function Shell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,rgba(15,92,86,0.09),transparent_52%)]">
      <div className="h-1.5 bg-[#9c3b2e]" />
      <div className="h-1 bg-primary" />
      <div className={`mx-auto px-4 py-6 pb-28 ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <Link href="/" className="text-sm font-medium tracking-wide text-primary">
          מנדטים
        </Link>
        {children}
      </div>
    </div>
  );
}
