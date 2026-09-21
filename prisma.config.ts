import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});