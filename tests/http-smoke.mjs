// Explicit local-only smoke test; retains a withdrawn test record and audit history.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const origin='http://localhost:3000';
const accounts=JSON.parse(await readFile('.local-data/demo-accounts.json','utf8'));
async function request(path,method='GET',body,cookie='',extra={}) {
 const res=await fetch(origin+path,{method,headers:{origin,'content-type':'application/json',cookie,...extra},body:body?JSON.stringify(body):undefined});
 return {status:res.status,data:await res.json(),cookie:res.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')};
}
assert.equal((await request('/api/staff/resources')).status,401);
const cookies={};
for(const account of accounts){const res=await request('/api/auth/sign-in/email','POST',{email:account.email,password:account.password});assert.equal(res.status,200);cookies[account.role]=res.cookie;}
const prior=await request('/api/staff/resources','GET',undefined,cookies.publisher); for(const r of prior.data.records.filter(r=>r.payload.title==='Local HTTP workflow verification' && r.published_revision_id)) await request(`/api/staff/resources/${r.id}`,'POST',{action:'withdraw',revisionId:r.revision_id,comment:'Cleanup of interrupted local smoke test'},cookies.publisher);
const payload={title:'Local HTTP workflow verification',summary:'A local test reference for verifying the complete API workflow.',body:'This is test content. It is withdrawn after the HTTP workflow smoke test completes.',type:'Report',region:'Arctic',topic:'Climate',year:2026,source:'https://example.org/test',sourceName:'Local test fixture',visibility:'public',rights:'external_reference_only',embargoUntil:null};
assert.equal((await request('/api/staff/resources','POST',payload,cookies.contributor,{origin:'https://untrusted.example'})).status,403);
const created=await request('/api/staff/resources','POST',payload,cookies.contributor);
assert.equal(created.status,201);
const item=created.data;
for(const [role,action] of [['contributor','submit'],['reviewer','approve'],['publisher','publish']]) {
 assert.equal((await request(`/api/staff/resources/${item.id}`,'POST',{action,revisionId:item.revision_id,comment:'Local HTTP smoke test'},cookies[role])).status,200);
}
let publicData=await request('/api/resources');
assert.ok(publicData.data.resources.some(r=>r.slug===item.slug));
assert.equal((await fetch(`${origin}/resources/${item.slug}`)).status,200);
assert.equal((await request(`/api/staff/resources/${item.id}`,'POST',{action:'withdraw',revisionId:item.revision_id,comment:'Completed local smoke test'},cookies.publisher)).status,200);
publicData=await request('/api/resources');
assert.ok(!publicData.data.resources.some(r=>r.slug===item.slug));
assert.equal((await fetch(`${origin}/resources/${item.slug}`)).status,404);
for(const cookie of Object.values(cookies)){assert.equal((await request('/api/auth/sign-out','POST',{},cookie)).status,200);assert.equal((await request('/api/staff/me','GET',undefined,cookie)).status,401);}
console.log('PASS: HTTP authentication, origin rejection, create/review/publish, public detail, withdrawal, 404 and logout.');

