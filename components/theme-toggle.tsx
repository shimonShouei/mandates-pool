"use client";

export function ThemeToggle() {
  return (
    <button
      type="button"
      className="rounded-full px-3 py-2 text-sm font-medium text-foreground ring-1 ring-border transition hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
      aria-label="החלפת מצב תצוגה"
      onClick={() => {
        const next = !document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", next);
        try {
          localStorage.setItem("mandatim-theme", next ? "dark" : "light");
        } catch {
          /* private mode */
        }
      }}
    >
      <span className="dark:hidden">כהה</span>
      <span className="hidden dark:inline">בהיר</span>
    </button>
  );
}
