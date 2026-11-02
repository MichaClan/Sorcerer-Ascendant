import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

// we maken een globaal variabel, dit is nodig voor de dev server van nextjs,
// zodat we niet op elke request een nieuwe verbinding maken.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// de adapter die prisma ondersteuning geeft voor MySQL
const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST, // localhost verbinding naar xampp/docker
  user: process.env.DB_USER, // gebruikersnaam
  password: process.env.DB_PASS, // password -- leeg
  database: process.env.DB_NAME, // de database naam
  port: Number(process.env.DB_PORT), // port naar de localhost xampp/docker verbinding
  allowPublicKeyRetrieval: true
});

// BELANGRIJKSTE DEEL, het variabel die we in andere bestanden kunnen IMPORTEREN
// Dit is de connectie met de DB
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;