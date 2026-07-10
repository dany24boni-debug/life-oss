const pat = process.env.SUPABASE_ACCESS_TOKEN;
const res = await fetch("https://api.supabase.com/v1/projects", {
  headers: { Authorization: `Bearer ${pat}` },
});
console.log("HTTP:", res.status);
const data = await res.json();
const summary = data.map((p) => ({
  ref: p.id,
  name: p.name,
  region: p.region,
  status: p.status,
  created_at: p.created_at,
}));
console.log(JSON.stringify(summary, null, 2));