# Usage:
#   npx tsx scripts/create-qari.ts "Name" email@example.com password123

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const ROLE: "QARI" | "STUDENT" | "FATHER" = "QARI";

async function main() {
  const [, , name, email, password] = process.argv;

  if (!name || !email || !password) {
    console.error(
      "Usage: npx tsx scripts/create-qari.ts <name> <email> <password>"
    );
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

  try {
    const emailLower = email.toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);

    const existing = await db.user.findUnique({
      where: { email: emailLower },
    });

    if (existing) {
      if (existing.role === ROLE) {
        await db.user.update({
          where: { id: existing.id },
          data: { name, passwordHash, active: true },
        });
        console.log(`Updated existing ${ROLE}: ${emailLower}`);
      } else {
        console.error(
          `${emailLower} already exists with role ${existing.role}. Use a different email.`
        );
        process.exit(1);
      }
    } else {
      await db.user.create({
        data: {
          name,
          email: emailLower,
          passwordHash,
          role: ROLE,
        },
      });
      console.log(`Created ${ROLE}: ${emailLower}`);
    }
  } catch (err) {
    console.error("Failed:", err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
