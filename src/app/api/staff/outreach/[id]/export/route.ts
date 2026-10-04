import { z } from 'zod';
import { staff,failure } from '@/server/http';
import { exportOutreach } from '@/server/outreach';
export const runtime='nodejs';
export async function GET(request:Request,ctx:{params:Promise<{id:string}>}){try{const user=await staff(request.headers);const text=await exportOutreach(user,z.string().uuid().parse((await ctx.params).id));return new Response(text,{headers:{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':'attachment; filename="polarbridge-reviewed-outreach.md"','Cache-Control':'no-store'}});}catch(e){return failure(e);}}
