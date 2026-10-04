import { z } from 'zod';
import { staff,json,failure,parseBody } from '@/server/http';
import { getOutreach,actOutreach } from '@/server/outreach';
import { outreachAction } from '@/lib/outreach-schema';
export const runtime='nodejs';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,ctx:Context){try{const user=await staff(request.headers);return json(await getOutreach(user,z.string().uuid().parse((await ctx.params).id)));}catch(e){return failure(e);}}
export async function POST(request:Request,ctx:Context){try{const user=await staff(request.headers);return json(await actOutreach(user,z.string().uuid().parse((await ctx.params).id),await parseBody(request,outreachAction)));}catch(e){return failure(e);}}
