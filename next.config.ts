import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Increase body size limit for ZIP uploads
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb"
    }
  }
}

export default nextConfig
