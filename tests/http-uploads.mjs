import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const origin='http://localhost:3000';
const account=JSON.parse(await readFile('.local-data/demo-accounts.json','utf8')).find(a=>a.role==='contributor');
const login=await fetch(`${origin}/api/auth/sign-in/email`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:account.email,password:account.password})});assert.equal(login.status,200);
const cookie=login.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
async function call(path,body){return fetch(origin+path,{method:body?'POST':'GET',headers:{origin,cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});}
try {
 const bytes=Buffer.from('%PDF-1.4\n% Local protocol test fixture, not a report\n%%EOF');
 const payload={name:'local-protocol-test.pdf',mime:'application/pdf',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 assert.equal((await fetch(origin+'/api/uploads',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(payload)})).status,401);
 assert.equal((await fetch(origin+'/api/uploads',{method:'POST',headers:{origin:'https://untrusted.example',cookie,'content-type':'application/json'},body:JSON.stringify(payload)})).status,403);
 const reservation=await call('/api/uploads',payload);assert.equal(reservation.status,201);const {id,target}=await reservation.json();assert.equal(target.kind,'local');
 assert.equal((await fetch(origin+target.url,{method:'PUT',headers:{origin,cookie},body:bytes})).status,200);
 assert.equal((await call(`/api/uploads/${id}`,{action:'complete'})).status,200);
 assert.equal((await call(`/api/uploads/${id}`,{action:'complete'})).status,200);
 assert.equal((await fetch(`${origin}/api/files/${id}`)).status,404);
 assert.equal((await call(`/api/files/${id}`)).status,409);
 assert.equal((await call(`/api/uploads/${id}`)).status,200);
 console.log('PASS: real HTTP PDF reservation/upload/finalization, duplicate finalization, anonymous denial, origin denial and quarantined download denial. Fixture stays quarantined.');
}finally{await call('/api/auth/sign-out',{});}
