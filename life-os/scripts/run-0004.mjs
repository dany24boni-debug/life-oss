import { readFileSync } from "node:fs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const pat = process.env.SUPABASE_ACCESS_TOKEN;
const ref = new URL(url).hostname.split(".")[0];
const sql = readFileSync("supabase/migrations/0004_add_lifeos_columns.sql", "utf8");
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
});
console.log("HTTP:", res.status);
const text = await res.text();
try { console.log(JSON.stringify(JSON.parse(text), null, 2)); }
catch { console.log(text); }