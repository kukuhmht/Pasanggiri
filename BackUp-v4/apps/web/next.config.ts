import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Transpile workspace packages
  transpilePackages: ['@pasanggiri/scoring'],
}

export default nextConfig
