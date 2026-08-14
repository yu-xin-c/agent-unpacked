import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/agent-unpacked",
  trailingSlash: true,
};

export default nextConfig;
