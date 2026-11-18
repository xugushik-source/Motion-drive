import { createSign } from "node:crypto";

/**
 * Mirrors the school's money into a Google Sheet through a service account (no paid service).
 * Needs two environment variables: GOOGLE_SERVICE_ACCOUNT_JSON (the key file, raw or base64) and
 * GOOGLE_SHEET_ID. Without them everything here is a quiet no-op.
 */
type Creds = { client_email: string; private_key: string };
type Fetcher = typeof fetch;
export function creds(): Creds | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const text = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
    const j = JSON.parse(text);
    if (!j.client_email || !j.private_key) return null;
    return {
      client_email: String(j.client_email),
      private_key: String(j.private_key).replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}
export const sheetId = () => process.env.GOOGLE_SHEET_ID || "";
export const sheetsConfigured = () => !!creds() && !!sheetId();
export const serviceEmail = () => creds()?.client_email || "";

const b64 = (x: string | Buffer) => Buffer.from(x).toString("base64url");
/** A signed service-account assertion (RS256 JWT), exchanged for a short-lived access token. */
export function signAssertion(c: Creds, now = Math.floor(Date.now() / 1000)) {
  const head = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64(
    JSON.stringify({
      iss: c.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const sig = createSign("RSA-SHA256")
    .update(`${head}.${body}`)
    .sign(c.private_key);
  return `${head}.${body}.${b64(sig)}`;
}
let cached: { value: string; exp: number } | null = null;
async function token(f: Fetcher) {
  if (cached && cached.exp > Date.now() + 60000) return cached.value;
  const c = creds();
  if (!c) throw new Error("sheets:not-configured");
  const r = await f("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signAssertion(c),
    }),
  });
  if (!r.ok) throw new Error("sheets:auth:" + r.status);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  cached = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.value;
}
const base = () => `https://sheets.googleapis.com/v4/spreadsheets/${sheetId()}`;
async function call(f: Fetcher, url: string, init: RequestInit = {}) {
  const r = await f(url, {
    ...init,
    headers: {
      Authorization: "Bearer " + (await token(f)),
      "Content-Type": "application/json",
    },
  });
  if (!r.ok)
    throw new Error(
      "sheets:" + r.status + ":" + (await r.text()).slice(0, 200),
    );
  return r.json() as Promise<any>;
}
const quote = (tab: string) => `'${tab.replace(/'/g, "''")}'`;
/** Creates the tab when it does not exist yet. */
async function ensureTab(f: Fetcher, tab: string) {
  const meta = await call(f, `${base()}?fields=sheets.properties.title`);
  if ((meta.sheets || []).some((s: any) => s.properties.title === tab)) return;
  await call(f, `${base()}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: tab } } }],
    }),
  });
}
/** Adds one row at the end of a tab (the live journal). Never throws: the school's work comes first. */
export async function appendRow(
  tab: string,
  row: (string | number)[],
  f: Fetcher = fetch,
) {
  if (!sheetsConfigured()) return false;
  try {
    await ensureTab(f, tab);
    await call(
      f,
      `${base()}/values/${encodeURIComponent(quote(tab) + "!A1")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values: [row] }) },
    );
    return true;
  } catch {
    return false;
  }
}
/** Replaces the whole content of a tab with a fresh snapshot. */
export async function replaceTab(
  tab: string,
  rows: (string | number)[][],
  f: Fetcher = fetch,
) {
  await ensureTab(f, tab);
  await call(f, `${base()}/values/${encodeURIComponent(quote(tab))}:clear`, {
    method: "POST",
    body: "{}",
  });
  if (rows.length)
    await call(
      f,
      `${base()}/values/${encodeURIComponent(quote(tab) + "!A1")}?valueInputOption=USER_ENTERED`,
      { method: "PUT", body: JSON.stringify({ values: rows }) },
    );
}
