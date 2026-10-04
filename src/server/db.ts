import { Pool, type PoolClient } from 'pg';

const globalDb = globalThis as unknown as { polarPool?: Pool };
export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_NOT_CONFIGURED');
  if (process.env.VERCEL && process.env.POLARBRIDGE_LOCAL_DB === '1') throw new Error('LOCAL_DATABASE_NOT_ALLOWED_ON_VERCEL');
  return globalDb.polarPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: process.env.POLARBRIDGE_LOCAL_DB === '1' ? 1 : 5,
    idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  });
}
export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
