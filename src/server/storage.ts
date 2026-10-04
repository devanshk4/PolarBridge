import { mkdir,readFile,writeFile,stat } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { S3Client,GetObjectCommand,HeadObjectCommand,PutObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
export function localStorage() {
 const local=process.env.POLARBRIDGE_STORAGE==='local';
 if(local && (process.env.VERCEL || process.env.POLARBRIDGE_LOCAL_DB!=='1'))throw new Error('LOCAL_STORAGE_FOR_DEVELOPMENT_ONLY');
 return local;
}
function path(key:string){if(!/^(quarantine|clean)\/[a-f0-9-]+$/.test(key))throw new Error('INVALID_KEY');return resolve(process.env.POLARBRIDGE_STORAGE_DIR || '.local-data/files',key);}
let client:S3Client|undefined;
function s3(){if(!process.env.S3_BUCKET)throw new Error('STORAGE_NOT_CONFIGURED');return client??=new S3Client({region:process.env.S3_REGION || 'us-east-1',endpoint:process.env.S3_ENDPOINT || undefined,forcePathStyle:process.env.S3_PATH_STYLE==='1'});}
export async function uploadTarget(id:string,key:string,mime:string,size:number,sha256:string){
 if(localStorage())return {kind:'local',url:`/api/uploads/${id}/bytes`};
 const result=await createPresignedPost(s3(),{Bucket:process.env.S3_BUCKET!,Key:key,Expires:300,
  Fields:{'Content-Type':mime,'x-amz-checksum-algorithm':'SHA256','x-amz-checksum-sha256':Buffer.from(sha256,'hex').toString('base64')},
  Conditions:[['content-length-range',size,size],['eq','$Content-Type',mime],['eq','$x-amz-checksum-algorithm','SHA256'],['eq','$x-amz-checksum-sha256',Buffer.from(sha256,'hex').toString('base64')]]});
 return {kind:'s3',...result};
}
export async function objectSize(key:string){if(localStorage())return (await stat(path(key))).size;return (await s3().send(new HeadObjectCommand({Bucket:process.env.S3_BUCKET!,Key:key}),{abortSignal:AbortSignal.timeout(15000)})).ContentLength;}
export async function readObject(key:string,max:number):Promise<Buffer>{
 if(localStorage()){if((await stat(path(key))).size>max)throw new Error('SIZE_LIMIT');return readFile(path(key));}
 const res=await s3().send(new GetObjectCommand({Bucket:process.env.S3_BUCKET!,Key:key}),{abortSignal:AbortSignal.timeout(60000)});
 if(!res.Body || !res.ContentLength || res.ContentLength>max)throw new Error('SIZE_LIMIT');
 const parts:Buffer[]=[];let size=0;
 for await(const part of res.Body as AsyncIterable<Uint8Array>){size+=part.length;if(size>max){(res.Body as {destroy?:()=>void}).destroy?.();throw new Error('SIZE_LIMIT');}parts.push(Buffer.from(part));}
 return Buffer.concat(parts);
}
export async function writeObject(key:string,bytes:Buffer,mime:string){
 if(localStorage()){const target=path(key);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'});return;}
 await s3().send(new PutObjectCommand({Bucket:process.env.S3_BUCKET!,Key:key,Body:bytes,ContentType:mime,IfNoneMatch:'*'}),{abortSignal:AbortSignal.timeout(60000)});
}
export async function downloadTarget(key:string,mime:string,inline:boolean){
 return getSignedUrl(s3(),new GetObjectCommand({Bucket:process.env.S3_BUCKET!,Key:key,ResponseContentType:mime,ResponseCacheControl:'private, no-store',ResponseContentDisposition:inline?'inline':'attachment'}),{expiresIn:60});
}
