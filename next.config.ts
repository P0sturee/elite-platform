import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // The marketing site (public/site.html) is the home page; the platform lives on the other routes.
      beforeFiles: [{ source: "/", destination: "/site.html" }],
    };
  },
  async redirects() {
    return [
      { source: "/site.html", destination: "/", permanent: true },
      // One canonical address: www and the old app subdomain go to the main domain.
      {
        source: "/:path*",
        has: [{ type: "host", value: "(?<sub>www|app)\\.elitesystems\\.online" }],
        destination: "https://elitesystems.online/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
