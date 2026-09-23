import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Content Security Policy: strict enough to be meaningful, permissive enough
// for Next.js dev + Tailwind + Cloudinary uploads + audio playback.
const csp = [
  "default-src 'self'",
  // Next.js injects inline scripts for hydration; 'unsafe-inline' is required.
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "font-src 'self' data:",
  // Audio playback comes from res.cloudinary.com (delivered files)
  "media-src 'self' blob: https://res.cloudinary.com",
  // Network connections:
  //   - openrouter.ai        : AI assistant
  //   - api.cloudinary.com   : DIRECT UPLOADS (this was missing before!)
  //   - res.cloudinary.com   : playback / metadata
  "connect-src 'self' https://openrouter.ai https://api.cloudinary.com https://res.cloudinary.com",
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
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
        ],
      },
    ];
  },
};

export default nextConfig;