import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@neondatabase/serverless", "ws", "node:sqlite"],
};

export default nextConfig;
