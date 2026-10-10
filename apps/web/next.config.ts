import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // Cloudflare Pages uses @opennextjs/cloudflare — standalone output is not needed
  ...(!isProd && { output: "standalone" }),
  async rewrites() {
    // In production NEXT_PUBLIC_API_URL is set (Cloudflare Pages dashboard) so
    // the API client calls the backend directly — no rewrite proxy needed.
    // In dev we proxy /api/* to the local Cargo server on :3000.
    if (isProd) return [];
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:3000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
