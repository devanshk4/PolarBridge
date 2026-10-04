import { z } from 'zod';
import { staff,failure,HttpError,type Staff } from '@/server/http';
import { readableFile } from '@/server/files';
import { localStorage,readObject,downloadTarget } from '@/server/storage';
export const runtime='nodejs';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{
 const {id}=await context.params;if(!z.string().uuid().safeParse(id).success)throw new HttpError(404,'File unavailable.');
 let user:Staff|undefined;try{user=await staff(request.headers);}catch(e){if(!(e instanceof HttpError) || ![401,403].includes(e.status))throw e;}
 const file=await readableFile(id,user);if(file.status!=='clean' || !file.clean_key)throw new HttpError(409,'This file is not available until scanning succeeds.');
 const inline=new URL(request.url).searchParams.get('preview')==='1' && file.mime.startsWith('image/');
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Referrer-Policy':'no-referrer'};
 if(!localStorage())return new Response(null,{status:302,headers:{...headers,Location:await downloadTarget(file.clean_key,file.mime,inline)}});
 return new Response(new Uint8Array(await readObject(file.clean_key,file.clean_size)),{headers:{...headers,'Content-Type':file.mime,'Content-Disposition':`${inline?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(file.original_name).replace(/'/g,'%27')}`}});
 }catch(e){return failure(e);}}
