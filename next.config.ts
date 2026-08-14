import type { NextConfig } from "next";

const isEdgeOne = process.env.NEXT_PUBLIC_DEPLOY_TARGET === "edgeone";

const nextConfig: NextConfig = {
  output: "export",
  ...(isEdgeOne ? {} : { basePath: "/agent-unpacked" }),
  trailingSlash: true,
};

export default nextConfig;
