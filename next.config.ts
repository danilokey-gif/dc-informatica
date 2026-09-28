import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    // O lint roda normalmente em `npm run lint` / dev; não deve travar o deploy de produção.
    ignoreDuringBuilds: true,
  },
  // O cliente da NF-e lê esse .pem via fs em tempo de execução (não é um import), então o
  // rastreamento automático de arquivos da Vercel não o inclui sozinho no bundle serverless.
  outputFileTracingIncludes: {
    '/**/*': ['./src/lib/nfe/ca-icp-brasil.pem'],
  },
  // O pdfkit calcula o caminho das fontes padrão (.afm) com base em __dirname. Empacotado pelo
  // Next isso quebra (o arquivo final fica numa pasta diferente da original do pacote). Mantendo
  // o pdfkit fora do bundle, ele roda direto do node_modules e o caminho relativo funciona.
  serverExternalPackages: ['pdfkit'],
  experimental: {
    serverActions: {
      // A importação de XMLs de NF-e manda os arquivos por Server Action, cujo limite padrão é 1 MB.
      // 4 MB fica abaixo do teto de 4,5 MB por requisição da Vercel; lotes maiores vão compactados
      // em .zip (XML comprime ~10x) ou em mais de um envio.
      bodySizeLimit: '4mb',
    },
  },
}

export default nextConfig
