"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="font-heading text-4xl">משהו השתבש</h1>
      <p className="mt-2 text-muted-foreground">אפשר לנסות שוב. הניחושים השמורים לא נמחקו.</p>
      <button type="button" onClick={reset} className="mt-6 h-11 rounded-lg bg-primary px-4 text-primary-foreground">
        נסו שוב
      </button>
    </main>
  );
}
