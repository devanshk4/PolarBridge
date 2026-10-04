import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
if(process.env.POLARBRIDGE_LOCAL_DB!=='1'||process.env.VERCEL)throw new Error('Local demo only');
const origin='http://localhost:3000';
const accounts=JSON.parse(await readFile('.local-data/demo-accounts.json','utf8'));
const cookies={};
async function request(path,method='GET',body,cookie='',extra={}){const response=await fetch(origin+path,{method,headers:{origin,'content-type':'application/json',cookie,...extra},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json(),cookie:response.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')};}
try{
 assert.equal((await request('/api/staff/outreach')).status,401);
 for(const a of accounts){const r=await request('/api/auth/sign-in/email','POST',{email:a.email,password:a.password});assert.equal(r.status,200);cookies[a.role]=r.cookie;}
 const initial=await request('/api/staff/outreach','GET',undefined,cookies.contributor);assert.equal(initial.status,200);
 const source=initial.data.sources.find(s=>s.slug==='demonstration-from-private-upload-to-public-discovery-900ce961');assert(source,'Run the real scanner demonstration first');
 const payload={title:'Behind the scenes: a journey from file to story',format:'Student explainer',language:'English',sourceIds:[source.revision_id],previousId:null,generationId:null,paragraphs:[{text:'This is a PolarBridge workflow demonstration. Its one-page PDF and plain blue image were generated for testing; they do not represent an expedition or a scientific finding.',citations:[source.chunks[1].id]},{text:'The demonstration files were uploaded privately, scanned, connected to a revision, reviewed by a separate demo account and released by a demo publisher.',citations:[source.chunks[source.chunks.length-1].id]}]};
 assert.equal((await request('/api/staff/outreach','POST',payload,cookies.contributor,{origin:'https://untrusted.example'})).status,403);
 const saved=await request('/api/staff/outreach','POST',payload,cookies.contributor);assert.equal(saved.status,201);const id=saved.data.id;
 assert.equal((await fetch(`${origin}/outreach/${id}`)).status,404);
 assert.equal((await fetch(`${origin}/api/staff/outreach/${id}/export`,{headers:{cookie:cookies.contributor}})).status,409);
 for(const [role,action] of [['contributor','submit'],['reviewer','approve'],['publisher','publish']])assert.equal((await request(`/api/staff/outreach/${id}`,'POST',{action,evidenceChecked:true,languageChecked:true,comment:'Generated demonstration only; checked against the catalogue evidence.'},cookies[role])).status,200);
 assert.equal((await fetch(`${origin}/outreach/${id}`)).status,200);
 const exported=await fetch(`${origin}/api/staff/outreach/${id}/export`,{headers:{cookie:cookies.contributor}});assert.equal(exported.status,200);assert.match(await exported.text(),/Reviewed revision/);
 assert.equal((await request(`/api/staff/outreach/${id}`,'POST',{action:'withdraw',comment:'Verify withdrawal before releasing the fresh demo revision.'},cookies.publisher)).status,200);
 assert.equal((await fetch(`${origin}/outreach/${id}`)).status,404);
 assert.equal((await fetch(`${origin}/api/staff/outreach/${id}/export`,{headers:{cookie:cookies.contributor}})).status,409);
 const revised=await request('/api/staff/outreach','POST',{...payload,previousId:id},cookies.contributor);assert.equal(revised.status,201);
 for(const [role,action] of [['contributor','submit'],['reviewer','approve'],['publisher','publish']])assert.equal((await request(`/api/staff/outreach/${revised.data.id}`,'POST',{action,evidenceChecked:true,languageChecked:true,comment:'Fresh demonstration revision checked and reviewed.'},cookies[role])).status,200);
 // Leave one Hindi manual draft to demonstrate the language editor, explicitly marked as a fixture.
 const hindi=await request('/api/staff/outreach','POST',{...payload,title:'एक फ़ाइल से कहानी तक: प्रदर्शन का उदाहरण',language:'Hindi',paragraphs:[{text:'यह PolarBridge का प्रदर्शन उदाहरण है। इसमें एक पृष्ठ की PDF और एक सादा नीला चित्र इस्तेमाल किया गया है। ये किसी अभियान या वैज्ञानिक खोज का प्रमाण नहीं हैं।',citations:[source.chunks[1].id]}]},cookies.contributor);assert.equal(hindi.status,201);
 await writeFile('.local-data/outreach-demo.json',JSON.stringify({publishedId:revised.data.id,hindiDraftId:hindi.data.id},null,2));
 console.log(`PASS: outreach HTTP authorization, origin protection, save/review/publish, export, withdrawal and republish. Manual demo: ${origin}/outreach/${revised.data.id}`);
}finally{for(const cookie of Object.values(cookies))await request('/api/auth/sign-out','POST',{},cookie);}
