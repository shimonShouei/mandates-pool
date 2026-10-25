/**
 * Which sign-in buttons exist. Google needs both OAuth vars. Email in
 * production needs a Resend key; outside production the dev inbox stands in.
 * Missing vars hide the provider. They do not stop the rest of the site.
 */
export function authModes(env: NodeJS.ProcessEnv = process.env): {
  google: boolean;
  email: boolean;
  devInbox: boolean;
} {
  const production = env.NODE_ENV === "production";
  const resend = Boolean(env.AUTH_RESEND_KEY);
  return {
    google: Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET),
    email: resend || !production,
    devInbox: !production && !resend,
  };
}
