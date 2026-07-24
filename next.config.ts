import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    // O lint roda normalmente em `npm run lint` / dev; não deve travar o deploy de produção.
    ignoreDuringBuilds: true,
  },
  // O cliente da NF-e lê esse .pem via fs em tempo de execução (não é um import), então o
  // rastreamento automático de arquivos da Vercel não o inclui sozinho no bundle serverless.
  // O pdfkit também carrega as fontes padrão (.afm) via fs em runtime, mesmo problema.
  outputFileTracingIncludes: {
    '/**/*': [
      './src/lib/nfe/ca-icp-brasil.pem',
      './node_modules/pdfkit/js/data/*.afm',
    ],
  },
}

export default nextConfig
