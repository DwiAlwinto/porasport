import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

// Selalu simpan di globalThis baik di production maupun development agar
// seluruh server action dan route handler berbagi satu pool koneksi database.
globalForPrisma.prisma = prisma;
