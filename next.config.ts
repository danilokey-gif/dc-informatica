import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    // O lint roda normalmente em `npm run lint` / dev; não deve travar o deploy de produção.
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
