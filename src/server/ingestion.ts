import sharp from 'sharp';
import { getPool,transaction } from './db';
import { hash } from './files';
import { readObject,writeObject } from './storage';
import { scanBytes } from './scanner';
export function detectedMime(b:Buffer){
 if(b.subarray(0,5).toString()==='%PDF-')return 'application/pdf';
 if(b.length>3 && b[0]===255 && b[1]===216 && b[2]===255)return 'image/jpeg';
 if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(b.subarray(0,4).toString()==='RIFF' && b.subarray(8,12).toString()==='WEBP')return 'image/webp';
 return null;
}
export async function prepareFile(bytes:Buffer,mime:string,scan:(b:Buffer)=>Promise<'clean'|'rejected'>=scanBytes){
 if(detectedMime(bytes)!==mime)throw new Error('REJECT_TYPE');
 if(await scan(bytes)!=='clean')throw new Error('REJECT_MALWARE');
 if(mime==='application/pdf')return bytes; // Never render untrusted PDF inline; extraction is a future bounded worker.
 try{return await sharp(bytes,{limitInputPixels:24000000,failOn:'warning',animated:false}).timeout({seconds:20}).rotate().toBuffer();}
 catch{throw new Error('REJECT_IMAGE');} // Re-encoding strips EXIF, GPS and other metadata.
}
export async function processNext(){
 const token=crypto.randomUUID();
 const file=await transaction(async db=>{
 const row=await db.query("SELECT * FROM media_files WHERE status='queued' OR (status='scanning' AND lease_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1");
 if(!row.rowCount)return null;const f=row.rows[0];
 await db.query("UPDATE media_files SET status='scanning',attempts=attempts+1,lease_id=$2,lease_until=now()+interval '10 minutes',updated_at=now() WHERE id=$1",[f.id,token]);
 await db.query("INSERT INTO media_events(file_id,action) VALUES($1,'scanning')",[f.id]);return f;});
 if(!file)return false;
 let state='clean',note='Malware scan passed.',key:string|null=null,size:number|null=null,checksum:string|null=null;
 try{
 const bytes=await readObject(file.quarantine_key,file.byte_size);
 if(bytes.length!==file.byte_size || hash(bytes)!==file.sha256)throw new Error('REJECT_CHECKSUM');
 const clean=await prepareFile(bytes,file.mime);
 key=`clean/${crypto.randomUUID()}`;await writeObject(key,clean,file.mime);size=clean.length;checksum=hash(clean);
 }catch(e){const code=(e as Error).message;state=code.startsWith('REJECT_')?'rejected':'failed';note=state==='rejected'?'File rejected: type, integrity, image decoding or malware check failed.':'Scanning could not finish. File remains private; check the worker and scanner, then retry.';key=null;}
 await transaction(async db=>{const updated=await db.query('UPDATE media_files SET status=$3,scan_note=$4,clean_key=$5,clean_size=$6,clean_sha256=$7,lease_id=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND lease_id=$2 AND status=\'scanning\' RETURNING id',[file.id,token,state,note,key,size,checksum]);
 if(updated.rowCount)await db.query('INSERT INTO media_events(file_id,action,note) VALUES($1,$2,$3)',[file.id,state,note]);});
 return true;
}
