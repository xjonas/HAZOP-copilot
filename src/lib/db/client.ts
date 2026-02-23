import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
  dbClient: postgres.Sql | undefined;
  drizzleDb: ReturnType<typeof drizzle<typeof schema>> | undefined;
  databaseUrl: string | undefined;
};

function getProjectRefFromSupabaseUrl(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return null;
  }

  try {
    const parsed = new URL(supabaseUrl);
    const hostPart = parsed.hostname.split('.')[0];
    return hostPart || null;
  } catch {
    return null;
  }
}

function normalizePoolerUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const isSupabasePooler = parsed.hostname.includes('pooler.supabase.com');
    const isPlainPostgresUser = parsed.username === 'postgres';

    if (!isSupabasePooler || !isPlainPostgresUser) {
      return rawUrl;
    }

    const projectRef = getProjectRefFromSupabaseUrl();
    if (!projectRef) {
      return rawUrl;
    }

    parsed.username = `postgres.${projectRef}`;
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function resolveRuntimeDatabaseUrl(): string {
  const runtimeUrl = process.env.DATABASE_URL || process.env.DATABASE_POOL_URL;
  if (!runtimeUrl) {
    throw new Error('DATABASE_URL or DATABASE_POOL_URL is required.');
  }

  return normalizePoolerUrl(runtimeUrl);
}

export function getDb() {
  const databaseUrl = resolveRuntimeDatabaseUrl();

  if (
    globalForDb.databaseUrl &&
    globalForDb.databaseUrl !== databaseUrl &&
    globalForDb.dbClient
  ) {
    globalForDb.dbClient.end({ timeout: 1 }).catch(() => undefined);
    globalForDb.dbClient = undefined;
    globalForDb.drizzleDb = undefined;
    globalForDb.databaseUrl = undefined;
  }

  if (globalForDb.drizzleDb) {
    return globalForDb.drizzleDb;
  }

  const client = globalForDb.dbClient ?? postgres(databaseUrl, {
    max: 10,
    prepare: false,
  });

  const db = drizzle(client, { schema });

  if (process.env.NODE_ENV !== 'production') {
    globalForDb.dbClient = client;
    globalForDb.drizzleDb = db;
    globalForDb.databaseUrl = databaseUrl;
  }

  return db;
}

export type Db = ReturnType<typeof getDb>;
