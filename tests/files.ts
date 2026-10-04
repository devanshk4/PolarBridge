import assert from 'node:assert/strict';
import { mkdtemp,mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { createServer } from 'node:net';
import { getPool } from '../src/server/db';
import { requestUpload,receiveLocal,completeUpload,ownedFile,readableFile,retryUpload,hash,publicMedia } from '../src/server/files';
import { prepareFile,processNext } from '../src/server/ingestion';
import { readObject } from '../src/server/storage';
import { createRecord,transitionRecord,reviseRecord } from '../src/server/catalogue';
import { uploadInput } from '../src/lib/file-schema';
import type { Staff } from '../src/server/http';
import type { RecordInput } from '../src/lib/record-schema';
// Called from the isolated database suite. Clean scan fixtures are never enabled in app/worker code.
export async function testFiles(author:Staff,other:Staff,reviewer:Staff,publisher:Staff,input:RecordInput){
 process.env.POLARBRIDGE_STORAGE='local';await mkdir('.local-data',{recursive:true});process.env.POLARBRIDGE_STORAGE_DIR=await mkdtemp('.local-data/file-test-');delete process.env.CLAMD_HOST;
 const photo=await sharp({create:{width:16,height:16,channels:3,background:'#dceef4'}}).jpeg().withExif({IFD0:{Artist:'Private metadata'}}).toBuffer();
 const clean=await prepareFile(photo,'image/jpeg',async()=> 'clean');
 assert.equal((await sharp(clean).metadata()).exif,undefined);
 await assert.rejects(()=>prepareFile(photo,'application/pdf',async()=> 'clean'),/REJECT_TYPE/);
 await assert.rejects(()=>prepareFile(photo,'image/jpeg',async()=> 'rejected'),/REJECT_MALWARE/);
 await assert.rejects(()=>prepareFile(photo,'image/jpeg'),/SCANNER_NOT_CONFIGURED/);
 assert.equal(uploadInput.safeParse({name:'bad.svg',mime:'image/jpeg',size:100,sha256:'0'.repeat(64)}).success,false);
 assert.equal(uploadInput.safeParse({name:'photo.jpg',mime:'image/jpeg',size:21*1024*1024,sha256:'0'.repeat(64)}).success,false);
 const uploaded=await requestUpload(author,{name:'polar.jpg',mime:'image/jpeg',size:photo.length,sha256:hash(photo)});
 await assert.rejects(()=>ownedFile(other,uploaded.id));
 await assert.rejects(()=>readableFile(uploaded.id,reviewer));
 await assert.rejects(()=>receiveLocal(other,uploaded.id,new Request('http://localhost',{method:'PUT',body:new Uint8Array(photo)})));
 await receiveLocal(author,uploaded.id,new Request('http://localhost',{method:'PUT',body:new Uint8Array(photo)}));
 await completeUpload(author,uploaded.id);await completeUpload(author,uploaded.id);
 assert.equal((await getPool().query("SELECT count(*)::int AS n FROM media_events WHERE file_id=$1 AND action='queued'",[uploaded.id])).rows[0].n,1);
 const a={fileId:uploaded.id,alt:'Illustrative polar photo',credit:'Test photographer',license:'Test permission',publicUseAllowed:true};
 await assert.rejects(()=>createRecord(other,{...input,attachments:[a]}));
 const record=await createRecord(author,{...input,attachments:[a]});
 await assert.rejects(()=>transitionRecord(author,record.id,{action:'submit',revisionId:record.revision_id,comment:''}));
 await processNext();assert.equal((await ownedFile(author,uploaded.id)).status,'failed');
 await retryUpload(author,uploaded.id);assert.equal((await ownedFile(author,uploaded.id)).status,'queued');
 // Explicit fake clamd endpoint, isolated to tests, exercises actual framing and worker persistence.
 const scanner=createServer(socket=>{let pending=Buffer.alloc(0),command=false;socket.on('data',chunk=>{pending=Buffer.concat([pending,typeof chunk==='string'?Buffer.from(chunk):chunk]);
 if(!command){const end=pending.indexOf(0);if(end<0)return;assert.equal(pending.subarray(0,end).toString(),'zINSTREAM');pending=pending.subarray(end+1);command=true;}
 while(pending.length>=4){const size=pending.readUInt32BE(0);if(pending.length<size+4)return;pending=pending.subarray(size+4);if(size===0){socket.end('stream: OK\0');return;}}
 });});
 await new Promise<void>(resolve=>scanner.listen(0,'127.0.0.1',resolve));
 process.env.CLAMD_HOST='127.0.0.1';process.env.CLAMD_PORT=String((scanner.address() as {port:number}).port);
 try{await processNext();}finally{delete process.env.CLAMD_HOST;delete process.env.CLAMD_PORT;await new Promise<void>(resolve=>scanner.close(()=>resolve()));}
 const ready=await ownedFile(author,uploaded.id);assert.equal(ready.status,'clean');
 assert.equal((await sharp(await readObject(ready.clean_key,ready.clean_size)).metadata()).exif,undefined);
 assert.equal(await processNext(),false);
 await assert.rejects(()=>getPool().query("UPDATE media_files SET clean_key='clean/changed' WHERE id=$1",[uploaded.id]));
 await assert.rejects(()=>readableFile(uploaded.id));
 for(const [actor,action] of [[author,'submit'],[reviewer,'approve'],[publisher,'publish']] as const)await transitionRecord(actor,record.id,{action,revisionId:record.revision_id,comment:''});
 assert.equal((await readableFile(uploaded.id)).status,'clean');assert.ok((await publicMedia()).some(f=>f.id===uploaded.id));
 const changed=await reviseRecord(author,record.id,record.revision_id,{...input,attachments:[{...a,publicUseAllowed:false}]});
 assert.equal((await readableFile(uploaded.id)).status,'clean'); // old published revision remains authoritative
 for(const [actor,action] of [[author,'submit'],[reviewer,'approve']] as const)await transitionRecord(actor,record.id,{action,revisionId:changed.revision_id,comment:''});
 await assert.rejects(()=>transitionRecord(publisher,record.id,{action:'publish',revisionId:changed.revision_id,comment:''}));
 await transitionRecord(publisher,record.id,{action:'withdraw',revisionId:changed.revision_id,comment:'Test withdrawal'});
 await assert.rejects(()=>readableFile(uploaded.id));assert.equal((await publicMedia()).length,0);
 await assert.rejects(()=>getPool().query('DELETE FROM media_events WHERE file_id=$1',[uploaded.id]));
 console.log('PASS: upload type/size/ownership, duplicate finalization, scan failure/retry, metadata stripping, immutable clean bytes, revision-bound rights, public access and withdrawal. Scanner successes use isolated test fixtures.');
}

