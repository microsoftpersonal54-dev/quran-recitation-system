# Usage:
#   node --env-file=.env.local scripts/create-qari.mjs "Name" email@example.com password123

import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const [, , name, email, password] = process.argv;

if (!name || !email || !password) {
  console.error("Usage: node scripts/create-qari.mjs <name> <email> <password>");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter });

const passwordHash = await bcrypt.hash(password, 12);

try {
  const existing = await db.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existing) {
    if (existing.role === "QARI") {
      await db.user.update({
        where: { id: existing.id },
        data: { name, passwordHash, active: true },
      });
      console.log(`Updated existing Qari: ${email}`);
    } else {
      console.error(
        `A user with email ${email} already exists with role ${existing.role}. Choose a different email.`
      );
      process.exit(1);
    }
  } else {
    await db.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: "QARI",
      },
    });
    console.log(`Created Qari: ${email}`);
  }
} catch (err) {
  console.error("Failed:", err);
  process.exit(1);
} finally {
  await db.$disconnect();
}
