import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'

// Testes automatizados das regras do sistema (notas, financeiro, backup). Rodam com `npm test`,
// sem banco de dados, sem internet e sem certificado: só as funções de cálculo e montagem.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: { AUTH_SECRET: 'segredo-apenas-para-os-testes', TZ: 'UTC' },
  },
})
