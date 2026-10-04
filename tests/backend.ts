import assert from 'node:assert/strict';
import { testOutreach } from './outreach';
import { testFiles } from './files';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { getMigrations } from 'better-auth/db/migration';
import { createAuth } from '../src/server/auth';
import { getPool } from '../src/server/db';
import { createRecord, reviseRecord, transitionRecord, publicRecords, getStaffRecord } from '../src/server/catalogue';
import { staff, type Staff } from '../src/server/http';
import type { RecordInput } from '../src/lib/record-schema';

process.env.DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54330/postgres';
process.env.BETTER_AUTH_URL='http://localhost:3000';
process.env.BETTER_AUTH_SECRET=crypto.randomUUID()+crypto.randomUUID();
process.env.POLARBRIDGE_LOCAL_DB='1';
const db=await PGlite.create();
const server=new PGLiteSocketServer({db,port:54330,host:'127.0.0.1',maxConnections:10});
await server.start();
try {
 const bootstrap=createAuth(true);
 await (await getMigrations(bootstrap.options)).runMigrations();
 await getPool().query(await readFile('db/001_catalogue.sql','utf8'));
 await getPool().query(await readFile('db/002_files.sql','utf8'));
 await getPool().query(await readFile('db/003_outreach.sql','utf8'));
 await getPool().query(await readFile('db/004_ai_providers.sql','utf8'));
 process.env.POLARBRIDGE_AI_PROVIDER='openai';
 const actors: Staff[]=[];
 for(const [i,role] of (['contributor','contributor','reviewer','publisher'] as const).entries()) {
  const result=await bootstrap.api.signUpEmail({body:{email:`test${i}@polarbridge.test`,name:`Test ${i}`,password:'Testing-password-42!'}});
  await getPool().query('INSERT INTO staff_members(user_id,role) VALUES($1,$2)',[result.user.id,role]);
  actors.push({...result.user,role});
 }
 const [author,other,reviewer,publisher]=actors;
 await assert.rejects(()=>staff(new Headers()));
 const auth=createAuth();
 await assert.rejects(()=>auth.api.signUpEmail({body:{email:'blocked@polarbridge.test',name:'Blocked',password:'Testing-password-42!'}}));
 const login=await auth.handler(new Request('http://localhost:3000/api/auth/sign-in/email',{method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:3000'},body:JSON.stringify({email:author.email,password:'Testing-password-42!'})}));
 assert.equal(login.status,200);
 const cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 assert.equal((await staff(new Headers({cookie}))).id,author.id);
 await getPool().query('UPDATE staff_members SET active=false WHERE user_id=$1',[author.id]);
 await assert.rejects(()=>staff(new Headers({cookie})));
 await getPool().query('UPDATE staff_members SET active=true WHERE user_id=$1',[author.id]);
 const input: RecordInput={title:'Polar science test reference',summary:'A reference used to verify editorial release controls.',body:'This test content is isolated from the demonstration database.',type:'Report',region:'Arctic',topic:'Climate',year:2026,source:'https://example.org/reference',sourceName:'Test source',visibility:'public',rights:'external_reference_only',embargoUntil:null};
 const record=await createRecord(author,input);
 const action=(actor:Staff,kind:any,revisionId=record.revision_id,comment='Test decision')=>transitionRecord(actor,record.id,{action:kind,revisionId,comment});
 assert.equal((await publicRecords()).length,0);
 await assert.rejects(()=>getStaffRecord(other,record.id));
 await assert.rejects(()=>reviseRecord(other,record.id,record.revision_id,input));
 await assert.rejects(()=>action(publisher,'publish'));
 await action(author,'submit');
 await assert.rejects(()=>reviseRecord(author,record.id,record.revision_id,input));
 await assert.rejects(()=>action({...author,role:'reviewer'},'approve'));
 await action(reviewer,'approve');
 await assert.rejects(()=>action(author,'publish'));
 await action(publisher,'publish');
 assert.equal((await publicRecords())[0].title,input.title);
 const revised=await reviseRecord(author,record.id,record.revision_id,{...input,title:'Revised polar reference title'});
 assert.equal((await publicRecords())[0].title,input.title);
 await assert.rejects(()=>action(author,'submit'));
 await assert.rejects(()=>action(publisher,'publish',revised.revision_id));
 await action(author,'submit',revised.revision_id);
 await action(reviewer,'request_changes',revised.revision_id);
 await assert.rejects(()=>action(author,'submit',revised.revision_id));
 const final=await reviseRecord(author,record.id,revised.revision_id,{...input,title:'Final polar reference title'});
 await action(author,'submit',final.revision_id);
 await action(reviewer,'approve',final.revision_id);
 await action(publisher,'publish',final.revision_id);
 assert.equal((await publicRecords())[0].title,'Final polar reference title');
 await assert.rejects(()=>getPool().query("UPDATE catalogue_revisions SET payload='{}' WHERE id=$1",[final.revision_id]));
 await assert.rejects(()=>getPool().query('DELETE FROM editorial_events WHERE resource_id=$1',[record.id]));
 await action(publisher,'withdraw',final.revision_id);
 assert.equal((await publicRecords()).length,0);
 for(const patch of [{rights:'unknown'},{embargoUntil:'2099-01-01T00:00:00.000Z'},{visibility:'staff'}]) {
  const item=await createRecord(author,{...input,...patch} as RecordInput);
  for(const [actor,kind] of [[author,'submit'],[reviewer,'approve']] as const) await transitionRecord(actor,item.id,{action:kind,revisionId:item.revision_id,comment:''});
  await assert.rejects(()=>transitionRecord(publisher,item.id,{action:'publish',revisionId:item.revision_id,comment:''}));
  assert.equal((await getStaffRecord(author,item.id)).status,'approved');
 }
 const restricted=await createRecord(author,{...input,visibility:'restricted'});
 await assert.rejects(()=>getStaffRecord(reviewer,restricted.id));
 await assert.rejects(()=>transitionRecord(author,restricted.id,{action:'submit',revisionId:restricted.revision_id,comment:''}));
 assert.equal((await publicRecords()).length,0);
 await testFiles(author,other,reviewer,publisher,input);
 await testOutreach(author,other,reviewer,publisher,input);
 console.log('PASS: authentication, disabled signup, account revocation, ownership, independent review, immutable history, stale revisions, publication replacement, withdrawal, rights, embargo and visibility.');
} finally { await getPool().end(); await server.stop(); await db.close(); }


