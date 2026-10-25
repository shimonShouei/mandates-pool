/**
 * Production boot with the vars Vercel already has, and without Google,
 * Resend, EMAIL_FROM, or AUTH_URL. Importing auth must not throw, and both
 * providers stay hidden.
 */
delete process.env.AUTH_URL;
delete process.env.NEXTAUTH_URL;
delete process.env.AUTH_GOOGLE_ID;
delete process.env.AUTH_GOOGLE_SECRET;
delete process.env.AUTH_RESEND_KEY;
delete process.env.EMAIL_FROM;
Object.assign(process.env, { NODE_ENV: "production" });
process.env.AUTH_SECRET = "build-check-auth-secret-not-a-real-key";
process.env.VERCEL = "1";
process.env.VERCEL_URL = "mandates-pool.vercel.app";

async function main() {
  const auth = await import("../auth");
  const modes = auth.authModes();
  if (modes.google || modes.email || modes.devInbox) {
    throw new Error(`providers should be hidden, got ${JSON.stringify(modes)}`);
  }
  if (typeof auth.handlers.GET !== "function" || typeof auth.handlers.POST !== "function") {
    throw new Error("auth handlers were not created");
  }
  console.log("auth boot ok without Google, Resend, or AUTH_URL");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
