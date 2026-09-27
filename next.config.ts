import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // The marketing site (public/site.html) is the home page; the platform lives on the other routes.
      beforeFiles: [{ source: "/", destination: "/site.html" }],
    };
  },
  async redirects() {
    return [{ source: "/site.html", destination: "/", permanent: true }];
  },
};

export default nextConfig;
