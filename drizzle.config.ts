import { defineConfig } from 'drizzle-kit';

const drizzleUrl = process.env.DATABASE_URL || process.env.DATABASE_POOL_URL;

if (!drizzleUrl) {
  throw new Error('DATABASE_URL or DATABASE_POOL_URL is required for Drizzle.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: drizzleUrl,
  },
});
