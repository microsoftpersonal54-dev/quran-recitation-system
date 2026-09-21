import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Content Security Policy: strict enough to be meaningful, permissive enough
// for Next.js dev + Tailwind. Audio plays from the same origin via blob:.
const csp = [
  "default-src 'self'",
  // Next.js injects inline scripts for hydration; 'unsafe-inline' is required.
  // In dev, also allow 'unsafe-eval' for the Turbopack runtime.
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "connect-src 'self' https://openrouter.ai",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Strict-Transport-Security",
    value: isProd ? "max-age=31536000; includeSubDomains" : "",
  },
].filter((h) => h.value !== "");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Never cache protected audio or API responses.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
        ],
      },
    ];
  },
};

export default nextConfig;