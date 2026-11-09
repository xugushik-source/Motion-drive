// Online data is accepted on Vercel only with durable PostgreSQL configured.
export const contactOnly =
  process.env.VERCEL === "1" && !process.env.DATABASE_URL;
export const siteUrl =
  process.env.APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");
