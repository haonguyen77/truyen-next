import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['mammoth', 'jszip', 'jsdom'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias.canvas = false
    }
    return config
  },
}

export default nextConfig
