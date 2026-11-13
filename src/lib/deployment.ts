// Which mode the site runs in.
//  - database: a PostgreSQL URL is set (Neon, Supabase, Vercel Postgres, ...): everything works.
//  - demo: a Vercel PREVIEW deployment without a database: a throw-away in-memory
//    database with sample data, so the owner can click through the real screens.
//  - contact-only: PRODUCTION on Vercel without a database: no visitor data is ever
//    accepted into an ephemeral database; clients are sent to the branch phones.
// Integrations name the variable differently, so the usual names are accepted.
/** The database address from the environment, whatever the integration called it. */
export function pickDatabaseUrl(env: Record<string, string | undefined>) {
  const plain = env.DATABASE_URL || env.POSTGRES_URL || env.POSTGRES_PRISMA_URL;
  if (plain) return plain;
  // Vercel integrations can add a prefix chosen at connect time (STORAGE_DATABASE_URL, ...).
  // Names such as *_URL_UNPOOLED / *_URL_NON_POOLING end differently and are not matched.
  const key = Object.keys(env).find(
    (k) => /_(DATABASE_URL|POSTGRES_URL)$/.test(k) && env[k],
  );
  return key ? (env[key] as string) : "";
}
export const databaseUrl = pickDatabaseUrl(process.env);
export const demoMode =
  process.env.VERCEL === "1" &&
  process.env.VERCEL_ENV !== "production" &&
  !databaseUrl;
export const contactOnly =
  process.env.VERCEL === "1" && !databaseUrl && !demoMode;
export const siteUrl =
  process.env.APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");
