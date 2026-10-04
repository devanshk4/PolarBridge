import { z } from 'zod';
import { staff,json,failure,parseBody,HttpError } from '@/server/http';
import { completeUpload,retryUpload,readableFile } from '@/server/files';
export const runtime='nodejs';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context){try{const {id}=await context.params;if(!z.string().uuid().safeParse(id).success)throw new HttpError(404,'File unavailable.');const f=await readableFile(id,await staff(request.headers));return json({id:f.id,original_name:f.original_name,mime:f.mime,byte_size:f.byte_size,status:f.status,scan_note:f.scan_note});}catch(e){return failure(e);}}
export async function POST(request:Request,context:Context){try{const user=await staff(request.headers);const {id}=await context.params;if(!z.string().uuid().safeParse(id).success)throw new HttpError(404,'File unavailable.');const {action}=await parseBody(request,z.object({action:z.enum(['complete','retry'])}).strict());return json(await (action==='complete'?completeUpload(user,id):retryUpload(user,id)));}catch(e){return failure(e);}}
