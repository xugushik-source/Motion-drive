// Vercel has no durable local disk. Never accept personal data there until
// the database adapter and storage have been migrated.
export const contactOnly = process.env.VERCEL === "1";
export const siteUrl = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
