import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getPool,transaction } from './db';
import { HttpError,type Staff } from './http';
import { uploadInput,type Attachment } from '../lib/file-schema';
import { localStorage,uploadTarget,writeObject,objectSize } from './storage';
export const fileColumns='id,original_name,mime,byte_size,status,scan_note,created_at';
export const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
export async function requestUpload(actor:Staff,input:unknown){
 if(actor.role!=='contributor')throw new HttpError(403,'Only contributors can upload files.');
 const v=uploadInput.parse(input);const id=crypto.randomUUID(),key=`quarantine/${id}`;
 // Serialise quota reservations by account so parallel requests cannot bypass limits.
 await transaction(async db=>{await db.query('SELECT user_id FROM staff_members WHERE user_id=$1 FOR UPDATE',[actor.id]);
 const quota=await db.query("SELECT count(*)::int AS n,coalesce(sum(byte_size),0)::bigint AS bytes FROM media_files WHERE owner_id=$1 AND created_at>now()-interval '1 day'",[actor.id]);
 if(quota.rows[0].n>=50 || Number(quota.rows[0].bytes)+v.size>500*1024*1024)throw new HttpError(429,'Daily upload allowance reached (50 files / 500 MB).');
 await db.query('INSERT INTO media_files(id,owner_id,original_name,mime,byte_size,sha256,quarantine_key) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,actor.id,v.name,v.mime,v.size,v.sha256,key]);
 await db.query("INSERT INTO media_events(file_id,action) VALUES($1,'requested')",[id]);});
 return {id,target:await uploadTarget(id,key,v.mime,v.size,v.sha256)};
}
export async function ownedFile(actor:Staff,id:string){const r=await getPool().query('SELECT * FROM media_files WHERE id=$1 AND owner_id=$2',[id,actor.id]);if(!r.rowCount)throw new HttpError(404,'File unavailable.');return r.rows[0];}
export async function receiveLocal(actor:Staff,id:string,request:Request){
 if(!localStorage())throw new HttpError(404,'Local upload unavailable.');
 const file=await ownedFile(actor,id);
 if(file.status!=='pending' || Date.now()-new Date(file.created_at).getTime()>300000)throw new HttpError(409,'Upload expired or already finalized. Start a new upload.');
 const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'File bytes required.');
 const parts:Buffer[]=[];let size=0;
 try{while(true){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>file.byte_size){await reader.cancel();throw new HttpError(413,'File exceeds the reserved size.');}parts.push(Buffer.from(p.value));}}finally{reader.releaseLock();}
 const bytes=Buffer.concat(parts);
 if(size!==file.byte_size || hash(bytes)!==file.sha256)throw new HttpError(422,'File size or checksum did not match.');
 try{await writeObject(file.quarantine_key,bytes,file.mime);}catch(e){if((e as {code?:string}).code!=='EEXIST')throw e;}
 return {received:true};
}
export async function completeUpload(actor:Staff,id:string){
 const file=await ownedFile(actor,id);if(file.status!=='pending')return {status:file.status};
 if(await objectSize(file.quarantine_key)!==file.byte_size)throw new HttpError(422,'Stored size does not match.');
 return transaction(async db=>{const updated=await db.query("UPDATE media_files SET status='queued',updated_at=now() WHERE id=$1 AND status='pending' RETURNING status",[id]);
 if(updated.rowCount)await db.query("INSERT INTO media_events(file_id,action) VALUES($1,'queued')",[id]);return {status:updated.rows[0]?.status || (await db.query('SELECT status FROM media_files WHERE id=$1',[id])).rows[0].status};});
}
export async function retryUpload(actor:Staff,id:string){await ownedFile(actor,id);return transaction(async db=>{const r=await db.query("UPDATE media_files SET status='queued',scan_note='',updated_at=now() WHERE id=$1 AND status='failed' AND attempts<5 RETURNING id",[id]);if(!r.rowCount)throw new HttpError(409,'Only failed scans with fewer than five attempts can be retried.');await db.query("INSERT INTO media_events(file_id,action) VALUES($1,'retry')",[id]);return {status:'queued'};});}
export async function validateAttachments(db:PoolClient,ownerId:string,attachments:Attachment[]=[],requireClean=false,publicRelease=false){
 for(const a of attachments){const r=await db.query('SELECT status FROM media_files WHERE id=$1 AND owner_id=$2',[a.fileId,ownerId]);
 if(!r.rowCount)throw new HttpError(422,'An attachment is unavailable or belongs to another contributor.');
 if(requireClean && r.rows[0].status!=='clean')throw new HttpError(422,'Every attachment must pass scanning before review or publication.');
 if(publicRelease && !a.publicUseAllowed)throw new HttpError(422,'Confirm public-use rights for every attachment before publication.');}
}
// Metadata and bytes both use the same current/published-revision access checks.
export async function readableFile(id:string,actor?:Staff){
 const f=await getPool().query('SELECT * FROM media_files WHERE id=$1',[id]);const file=f.rows[0];if(!file)throw new HttpError(404,'File unavailable.');
 if(actor?.id===file.owner_id)return file;
 const refs=await getPool().query(`SELECT v.payload,v.status,r.current_revision_id,r.published_revision_id,v.id FROM catalogue_revisions v JOIN catalogue_resources r ON r.id=v.resource_id WHERE v.payload->'attachments' @> $1::jsonb AND (v.id=r.current_revision_id OR v.id=r.published_revision_id)`,[JSON.stringify([{fileId:id}])]);
 for(const row of refs.rows){const p=row.payload;
 if(actor && actor.role!=='contributor' && p.visibility!=='restricted')return file;
 const a=p.attachments.find((x:Attachment)=>x.fileId===id);
 if(row.id===row.published_revision_id && row.status==='published' && p.visibility==='public' && p.rights==='external_reference_only' && (!p.embargoUntil || Date.parse(p.embargoUntil)<=Date.now()) && a?.publicUseAllowed && file.status==='clean')return file;}
 throw new HttpError(404,'File unavailable.');
}
export async function publicMedia(){const r=await getPool().query(`SELECT r.slug,v.payload,a.value AS attachment,f.id,f.original_name,f.mime,f.clean_size FROM catalogue_resources r JOIN catalogue_revisions v ON v.id=r.published_revision_id CROSS JOIN LATERAL jsonb_array_elements(coalesce(v.payload->'attachments','[]'::jsonb)) a JOIN media_files f ON f.id=(a.value->>'fileId')::uuid WHERE v.status='published' AND v.payload->>'visibility'='public' AND v.payload->>'rights'='external_reference_only' AND (v.payload->>'embargoUntil' IS NULL OR (v.payload->>'embargoUntil')::timestamptz<=now()) AND f.status='clean' AND a.value->>'publicUseAllowed'='true' ORDER BY r.updated_at DESC LIMIT 200`);return r.rows;}
