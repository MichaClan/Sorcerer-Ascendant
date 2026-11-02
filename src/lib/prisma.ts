import { PrismaClient } from "../generated/prisma/client";

// We maken een globale variabele. Dit is nodig voor de dev server van Next.js
// om te voorkomen dat er bij elke hot-reload een nieuwe verbinding wordt gemaakt.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// De Prisma client maakt nu direct verbinding met PostgreSQL via de DATABASE_URL uit je .env
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;