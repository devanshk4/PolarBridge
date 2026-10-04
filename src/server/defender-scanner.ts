import { mkdir,writeFile,readFile,unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
// File queue connects the Node ingestion worker to a separate Windows Defender worker.
// No uploaded content is executed, and the web server never launches subprocesses.
export async function scanWithDefender(bytes:Buffer):Promise<'clean'|'rejected'>{
 if(process.platform!=='win32' || process.env.VERCEL || process.env.POLARBRIDGE_LOCAL_DB!=='1')throw new Error('DEFENDER_LOCAL_ONLY');
 const root=resolve('.local-data/defender-queue');await mkdir(root,{recursive:true});
 const id=crypto.randomUUID(),sha256=createHash('sha256').update(bytes).digest('hex');
 const input=resolve(root,`${id}.bin`),request=resolve(root,`${id}.request.json`),result=resolve(root,`${id}.result.json`);
 try{
 await writeFile(input,bytes,{flag:'wx'});
 await writeFile(request,JSON.stringify({id,sha256,createdAt:new Date().toISOString()}),{flag:'wx'});
 const deadline=Date.now()+75000;
 while(Date.now()<deadline){
  const text=await readFile(result,'utf8').catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  if(text){const response=JSON.parse(text.replace(/^\uFEFF/,''));if(response.id!==id || response.sha256!==sha256)throw new Error('SCAN_RESULT_MISMATCH');
   if(response.verdict==='clean' || response.verdict==='rejected')return response.verdict;
   throw new Error('DEFENDER_SCAN_FAILED');}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw new Error('DEFENDER_SCAN_TIMEOUT');
 }finally{for(const path of [request,input,result])await unlink(path).catch(()=>{});}
}
