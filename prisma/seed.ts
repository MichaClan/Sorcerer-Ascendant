import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import { hash } from "bcrypt";

const adapter = new PrismaMariaDb({
  host: "db.eduinsights.nl",
  user: "u_wilson",
  password: "9e4bad05e9caec769d05097bc799034e",
  database: "db_wilson_nextjs_blok_3",
  port: 3306,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // Maak gebruikers aan met gekoppelde spelers
  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      email: "alice@example.com",
      password: await hash("password123", 10),
      name: "Alice",
      player: {
        create: { name: "Alice" },
      },
    },
    include: { player: true },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: {
      email: "bob@example.com",
      password: await hash("password123", 10),
      name: "Bob",
      player: {
        create: { name: "Bob" },
      },
    },
    include: { player: true },
  });

  // Maak een game aan met beide spelers
  const game = await prisma.game.create({
    data: {
      players: {
        create: [
          { playerId: alice.player!.id },
          { playerId: bob.player!.id },
        ],
      },
    },
  });

  console.log("Seeded:", { alice, bob, game });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
