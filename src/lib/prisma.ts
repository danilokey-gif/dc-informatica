import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

// Também em produção: a mesma função serverless reaproveita a conexão entre requisições.
globalForPrisma.prisma = prisma
