// Local integration test. Uses the real scanner and retains a labelled published demo.
import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { scanBytes } from '../src/server/scanner';
import { processNext } from '../src/server/ingestion';
import { getPool } from '../src/server/db';
import { hash } from '../src/server/files';
if(process.env.VERCEL || process.env.POLARBRIDGE_STORAGE!=='local' || process.env.POLARBRIDGE_LOCAL_DB!=='1')throw new Error('Run this test against the local demo only.');
const origin='http://localhost:3000';
const accounts=JSON.parse(await readFile('.local-data/demo-accounts.json','utf8'));
const cookies:Record<string,string>={};
async function request(path:string,method='GET',body?:unknown,role?:string){return fetch(origin+path,{method,headers:{origin,'content-type':'application/json',cookie:role?cookies[role]:''},body:body?JSON.stringify(body):undefined});}
async function json(path:string,method='GET',body?:unknown,role?:string){const res=await request(path,method,body,role);const data=await res.json();assert.ok(res.ok,`${method} ${path}: ${res.status} ${JSON.stringify(data)}`);return data;}
function pdf(text:string){const content=`BT /F1 14 Tf 50 760 Td (${text.replace(/[()\\]/g,'\\$&')}) Tj ET`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
 let file='%PDF-1.4\n',offsets=[0];objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(file));file+=`${i+1} 0 obj\n${object}\nendobj\n`;});const offset=Buffer.byteLength(file);file+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`;return Buffer.from(file);}
async function upload(name:string,mime:string,bytes:Buffer){const item=await json('/api/uploads','POST',{name,mime,size:bytes.length,sha256:hash(bytes)},'contributor');assert.equal(item.target.kind,'local');const r=await fetch(origin+item.target.url,{method:'PUT',headers:{origin,cookie:cookies.contributor},body:new Uint8Array(bytes)});assert.equal(r.status,200);await json(`/api/uploads/${item.id}`,'POST',{action:'complete'},'contributor');assert.equal((await request(`/api/files/${item.id}`)).status,404);return item.id as string;}
try{
 const eicar=Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
 assert.equal(await scanBytes(Buffer.from('PolarBridge harmless health test')),'clean');
 assert.equal(await scanBytes(eicar),'rejected');
 console.log('PASS real scanner: clean bytes accepted; standard harmless EICAR test string rejected.');
 for(const account of accounts){const r=await request('/api/auth/sign-in/email','POST',{email:account.email,password:account.password});assert.equal(r.status,200);cookies[account.role]=r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');}
 const document=pdf('POLARBRIDGE DEMO - Generated sample. Not institutional research.');
 const photograph=await sharp({create:{width:640,height:360,channels:3,background:'#d9edf3'}}).jpeg().withExif({IFD0:{Artist:'Local fixture metadata'}}).toBuffer();
 const pdfId=await upload('polarbridge-demo.pdf','application/pdf',document);
 const photoId=await upload('polarbridge-demo.jpg','image/jpeg',photograph);
 // The standard EICAR check above tests real antivirus detection. This separate
 // invalid-type upload verifies the application's rejection and download gates.
 const rejectedId=await upload('invalid-type-test.pdf','application/pdf',Buffer.from('This is not a PDF file.'));
 for(let n=0;n<20 && await processNext();n++);
 for(const id of [pdfId,photoId])assert.equal((await json(`/api/uploads/${id}`,'GET',undefined,'contributor')).status,'clean');
 assert.equal((await json(`/api/uploads/${rejectedId}`,'GET',undefined,'contributor')).status,'rejected');
 assert.equal((await request(`/api/files/${rejectedId}`)).status,404);
 assert.equal((await request(`/api/files/${rejectedId}`,'GET',undefined,'contributor')).status,409);
 const payload={title:'Demonstration: from private upload to public discovery',summary:'A generated sample report and image demonstrate the complete PolarBridge publishing workflow. This is not institutional research.',body:'This demonstration uses a generated one-page PDF and a plain blue test image. Neither represents an expedition or a scientific finding.\n\nThe files were uploaded privately, scanned by the configured local antivirus, attached to a revision, reviewed with a separate demo account and released by a demo publisher.',type:'Report',region:'Antarctica',topic:'Sea ice',year:2026,source:'https://example.org/polarbridge-demo',sourceName:'PolarBridge generated demonstration',visibility:'public',rights:'external_reference_only',embargoUntil:null,attachments:[{fileId:pdfId,alt:'Generated PolarBridge demonstration report',credit:'PolarBridge development fixture',license:'Generated for this prototype demonstration',publicUseAllowed:true},{fileId:photoId,alt:'Plain blue test image, not an expedition photograph',credit:'PolarBridge development fixture',license:'Generated for this prototype demonstration',publicUseAllowed:true}]};
 const record=await json('/api/staff/resources','POST',payload,'contributor');
 async function release(revisionId:string){for(const [role,action] of [['contributor','submit'],['reviewer','approve'],['publisher','publish']])await json(`/api/staff/resources/${record.id}`,'POST',{action,revisionId,comment:'Local workflow demonstration; not institutional scientific approval.'},role);}
 await release(record.revision_id);
 const publicPdf=await request(`/api/files/${pdfId}`);assert.equal(publicPdf.status,200);assert.equal(publicPdf.headers.get('content-type'),'application/pdf');assert.match(publicPdf.headers.get('content-disposition')!,/^attachment/);assert.equal(hash(Buffer.from(await publicPdf.arrayBuffer())),hash(document));
 const publicPhoto=await request(`/api/files/${photoId}?preview=1`);assert.equal(publicPhoto.status,200);assert.equal((await sharp(Buffer.from(await publicPhoto.arrayBuffer())).metadata()).exif,undefined);
 assert.equal((await request(`/resources/${record.slug}`)).status,200);
 assert.ok((await (await request('/media')).text()).includes(photoId));
 await json(`/api/staff/resources/${record.id}`,'POST',{action:'withdraw',revisionId:record.revision_id,comment:'Verifying immediate withdrawal of public downloads.'},'publisher');
 for(const id of [pdfId,photoId])assert.equal((await request(`/api/files/${id}`)).status,404);
 assert.equal((await request(`/resources/${record.slug}`)).status,404);
 // Leave one usable, explicitly labelled demonstration for the user, after a fresh review.
 const revision=await json(`/api/staff/resources/${record.id}`,'PATCH',{revisionId:record.revision_id,record:payload},'contributor');await release(revision.revision_id);
 const result={date:new Date().toISOString(),slug:record.slug,resourceId:record.id,pdfId,photoId,rejectedId,result:'passed'};await writeFile('.local-data/real-scanner-result.json',JSON.stringify(result,null,2));
 console.log(`PASS upload → scan → review → publish → download → withdraw → fresh approval. Demo: ${origin}/resources/${record.slug}`);
}finally{for(const role of Object.keys(cookies))await request('/api/auth/sign-out','POST',{},role);await getPool().end();}
