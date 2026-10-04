import { readFile } from 'node:fs/promises';
import { getMigrations } from 'better-auth/db/migration';
import { getAuth } from '../src/server/auth';
import { getPool,transaction } from '../src/server/db';
// Runtime uses the pooled URL; maintenance may use a separately supplied direct URL.
if(process.env.DATABASE_URL_UNPOOLED)process.env.DATABASE_URL=process.env.DATABASE_URL_UNPOOLED;
const { runMigrations }=await getMigrations(getAuth().options);
await runMigrations();
await getPool().query('CREATE TABLE IF NOT EXISTS app_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())');
await transaction(async db=>{
  await db.query('LOCK TABLE app_migrations IN EXCLUSIVE MODE');
  for(const migration of ['001_catalogue','002_files','003_outreach','004_ai_providers']) {
  const applied=await db.query('SELECT name FROM app_migrations WHERE name=$1',[migration]);
  if(!applied.rowCount){await db.query(await readFile(`db/${migration}.sql`,'utf8'));await db.query('INSERT INTO app_migrations(name) VALUES($1)',[migration]);}
  }
});
console.log('Authentication and catalogue migrations are current.');
await getPool().end();
