import { z } from 'zod';
import { staff,json,failure,HttpError } from '@/server/http';
import { receiveLocal } from '@/server/files';
export const runtime='nodejs';
export async function PUT(request:Request,context:{params:Promise<{id:string}>}){try{
 if(request.headers.get('origin')!==new URL(process.env.BETTER_AUTH_URL!).origin)throw new HttpError(403,'Request origin is not allowed.');
 const {id}=await context.params;if(!z.string().uuid().safeParse(id).success)throw new HttpError(404,'File unavailable.');
 return json(await receiveLocal(await staff(request.headers),id,request));}catch(e){return failure(e);}}
