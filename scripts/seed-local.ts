import { randomBytes } from 'node:crypto';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createAuth } from '../src/server/auth';
import { getPool } from '../src/server/db';
import { createRecord,transitionRecord } from '../src/server/catalogue';
import { resources } from '../src/lib/data';
import type { Staff,Role } from '../src/server/http';
if(process.env.VERCEL || process.env.POLARBRIDGE_LOCAL_DB!=='1') throw new Error('This seeder is local-only.');
await mkdir('.local-data',{recursive:true});
const auth=createAuth(true);
const path='.local-data/demo-accounts.json';
const saved=existsSync(path)?JSON.parse(await readFile(path,'utf8')):[];
const accounts: Array<Staff & {password:string}>=[];
for(const role of ['contributor','reviewer','publisher'] as Role[]) {
 const email=`${role}@polarbridge.test`;
 const existing=await getPool().query('SELECT id,name FROM "user" WHERE email=$1',[email]);
 let account=saved.find((a:{email:string})=>a.email===email);
 if(!existing.rowCount){
  const password=randomBytes(18).toString('base64url');
  const name=`Demo ${role[0].toUpperCase()+role.slice(1)}`;
  const created=await auth.api.signUpEmail({body:{email,password,name}});
  account={id:created.user.id,email,name,role,password};
 } else if(!account) throw new Error('A demo account exists but its local credentials file is missing. Provision a new account manually.');
 await getPool().query('INSERT INTO staff_members(user_id,role) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING',[account.id,role]);
 accounts.push(account);
 await writeFile(path,JSON.stringify([...saved.filter((a:{email:string})=>!accounts.some(b=>a.email===b.email)),...accounts],null,2));
}
const contributor=accounts.find(a=>a.role==='contributor')!;
const reviewer=accounts.find(a=>a.role==='reviewer')!;
const publisher=accounts.find(a=>a.role==='publisher')!;
for(const resource of resources.filter(r=>!r.sample)){
 if((await getPool().query('SELECT id FROM catalogue_resources WHERE slug=$1',[resource.slug])).rowCount) continue;
 const created=await createRecord(contributor,{title:resource.title,summary:resource.summary,body:resource.body.join('\n\n'),type:resource.type,region:resource.region,topic:resource.topic as 'Atmosphere',year:resource.year,source:resource.source,sourceName:resource.sourceName,visibility:'public',rights:'external_reference_only',embargoUntil:null},resource.slug);
 for(const [actor,action] of [[contributor,'submit'],[reviewer,'approve'],[publisher,'publish']] as const) await transitionRecord(actor,created.id,{action,revisionId:created.revision_id,comment:'Local demonstration seed. Workflow example; not institutional scientific approval.'});
}
console.log('Demo accounts and four source references are ready. Credentials are in .local-data/demo-accounts.json; never deploy or commit them.');
await getPool().end();
