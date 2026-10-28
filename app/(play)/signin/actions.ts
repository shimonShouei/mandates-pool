"use server";

import { signIn, signOut } from "@/auth";
import { cleanEmail } from "@/lib/accounts";
import { safeNext } from "@/lib/safe-next";

export type SignInResult = { ok: true } | { ok: false; error: string };

function isRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).includes("NEXT_REDIRECT")
  );
}

export async function sendMagicLink(formData: FormData): Promise<SignInResult> {
  const email = cleanEmail(String(formData.get("email") || ""));
  if (!email) return { ok: false, error: "המייל לא נראה תקין." };
  const redirectTo = safeNext(String(formData.get("callbackUrl") || ""));
  try {
    await signIn("resend", { email, redirectTo });
    return { ok: true };
  } catch (error) {
    if (isRedirect(error)) throw error;
    console.error(error);
    return { ok: false, error: "לא הצלחנו לשלוח קישור. נסו שוב." };
  }
}

export async function googleSignIn(formData: FormData) {
  const redirectTo = safeNext(String(formData.get("callbackUrl") || ""));
  await signIn("google", { redirectTo });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
