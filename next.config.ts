import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@neondatabase/serverless", "ws", "node:sqlite", "pg"],
};

export default nextConfig;
