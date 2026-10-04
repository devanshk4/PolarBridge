import { existsSync } from 'node:fs';
import { writeFile,mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
if(process.env.VERCEL) throw new Error('Local setup is not permitted on Vercel.');
await mkdir('.local-data',{recursive:true});
if(!existsSync('.env.local')) {
 await writeFile('.env.local',`DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/postgres\nBETTER_AUTH_URL=http://localhost:3000\nBETTER_AUTH_SECRET=${randomBytes(48).toString('base64url')}\nPOLARBRIDGE_LOCAL_DB=1\nPOLARBRIDGE_STORAGE=local\n`);
 console.log('Created ignored local configuration with a random authentication secret.');
} else console.log('Existing local configuration preserved.');
