import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: "/companion-sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
          { key: "Service-Worker-Allowed", value: "/companion" },
        ],
      },
    ];
  },
};

export default nextConfig;
