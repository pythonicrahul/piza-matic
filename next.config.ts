import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // Allow testing the dev server from other devices on the LAN (e.g. a phone).
  allowedDevOrigins: ["192.168.1.2", "192.168.1.*", "*.local"],
  // Hide the on-screen Next.js dev indicator (the floating "N"). Dev-only anyway.
  devIndicators: false,
};

export default nextConfig;
