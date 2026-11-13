// db/postgres.sql is the single source of the schema. The site applies it on first
// start (serverless bundles cannot rely on reading loose files), so it is embedded.
import { readFileSync, writeFileSync } from "node:fs";
const sql = readFileSync("db/postgres.sql", "utf8");
writeFileSync(
  "src/lib/postgres-schema.ts",
  "// Generated from db/postgres.sql by `npm run sync:schema`. Do not edit.\nexport const postgresSchema = " +
    JSON.stringify(sql) +
    ";\n",
);
console.log("src/lib/postgres-schema.ts updated");
