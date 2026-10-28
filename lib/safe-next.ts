/** Relative in-app paths only, so a callback cannot send someone off this site. */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/me";
  return value;
}
