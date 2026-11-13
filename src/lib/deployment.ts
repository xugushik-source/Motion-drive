// Which mode the site runs in.
//  - database: a PostgreSQL URL is set (Neon, Supabase, Vercel Postgres, ...): everything works.
//  - demo: a Vercel PREVIEW deployment without a database: a throw-away in-memory
//    database with sample data, so the owner can click through the real screens.
//  - contact-only: PRODUCTION on Vercel without a database: no visitor data is ever
//    accepted into an ephemeral database; clients are sent to the branch phones.
// Integrations name the variable differently, so the usual names are accepted.
export const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  "";
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
