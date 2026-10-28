import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import type { Provider } from "next-auth/providers";
import { appAuthAdapter } from "@/lib/auth-adapter";
import { authModes } from "@/lib/auth-modes";
import { storeDevMail } from "@/lib/dev-mail";
import { authRedirect } from "@/lib/public-origin";

export { authModes } from "@/lib/auth-modes";

if (!process.env.AUTH_SECRET && process.env.NODE_ENV !== "production") {
  process.env.AUTH_SECRET = "dev-only-mandatim-auth-secret";
}

function providers(): Provider[] {
  const modes = authModes();
  const list: Provider[] = [];
  if (modes.google && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    list.push(
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }
  if (modes.email) {
    list.push(
      Resend({
        apiKey: process.env.AUTH_RESEND_KEY || "dev",
        from: process.env.EMAIL_FROM || "Mandatim <onboarding@resend.dev>",
        maxAge: 60 * 60,
        async sendVerificationRequest({ identifier, url, provider }) {
          if (process.env.AUTH_RESEND_KEY) {
            const response = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${provider.apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: provider.from,
                to: identifier,
                subject: "קישור כניסה למנדטים",
                text: `כניסה למנדטים:\n${url}\n\nהקישור נפתח פעם אחת, ובתוקף לשעה.`,
                html: `<p>כניסה למנדטים:</p><p><a href="${escapeHtml(url)}">לחצו כאן</a></p><p>הקישור נפתח פעם אחת, ובתוקף לשעה.</p>`,
              }),
            });
            if (!response.ok) throw new Error("שליחת המייל נכשלה.");
            return;
          }
          if (process.env.NODE_ENV === "production") {
            throw new Error("שליחת מייל לא הוגדרה.");
          }
          await storeDevMail(identifier, url);
        },
      }),
    );
  }
  return list;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

// AUTH_URL is optional. trustHost reads the request host, which on Vercel is
// the production domain or the deployment host (VERCEL_URL). Copying
// VERCEL_URL into AUTH_URL would pin callbacks to that deployment hostname
// and drop the session cookie on the public alias, so it is left unset.
const nextAuth = process.env.AUTH_SECRET
  ? NextAuth({
      adapter: appAuthAdapter(),
      providers: providers(),
      trustHost: true,
      session: { strategy: "database", maxAge: 60 * 60 * 24 * 180 },
      pages: {
        signIn: "/signin",
        verifyRequest: "/signin/sent",
        error: "/signin",
      },
      callbacks: {
        redirect({ url, baseUrl }) {
          return authRedirect(url, baseUrl);
        },
        session({ session, user }) {
          session.user.id = user.id;
          return session;
        },
      },
    })
  : null;

export const handlers = nextAuth?.handlers ?? {
  GET: () => new Response("הכניסה לא הוגדרה.", { status: 503 }),
  POST: () => new Response("הכניסה לא הוגדרה.", { status: 503 }),
};

export const auth = nextAuth?.auth ?? (async () => null);
export const signIn = nextAuth?.signIn ?? (async () => {
  throw new Error("הכניסה לא הוגדרה.");
});
export const signOut = nextAuth?.signOut ?? (async () => undefined);

export async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  if (!process.env.AUTH_SECRET) return null;
  try {
    const session = await auth();
    const id = session?.user?.id;
    if (!id) return null;
    return { id, email: session.user.email ?? null };
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function currentUserId(): Promise<string | null> {
  return (await currentUser())?.id ?? null;
}
