import type { NextConfig } from "next";
import path from "path";

// Defence-in-depth HTTP security headers.
// Applied to every response. Tightening the CSP is intentional: the
// app does not embed third-party scripts, only Supabase REST + WS,
// Anthropic API (server-side), and Google OAuth + Calendar (server-side).
//
// 'unsafe-inline' for script-src is required by Next.js's runtime
// inline scripts; it can be replaced with nonces in a future hardening
// pass. style-src 'unsafe-inline' is needed by Tailwind v4's @theme
// runtime injection.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    // Browsers honour HSTS only when served over HTTPS — harmless on
    // localhost dev (the header is ignored over HTTP).
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://oauth2.googleapis.com https://www.googleapis.com https://accounts.google.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://accounts.google.com",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
