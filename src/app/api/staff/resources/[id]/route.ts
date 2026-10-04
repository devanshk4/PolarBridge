import { z } from 'zod';
import { staff,json,failure,parseBody,HttpError } from '@/server/http';
import { getStaffRecord,reviseRecord,transitionRecord } from '@/server/catalogue';
import { recordInput,transitionInput } from '@/lib/record-schema';
export const runtime = 'nodejs';
type Context = { params: Promise<{id:string}> };
async function idFrom(context:Context) { const {id}=await context.params; if(!z.string().uuid().safeParse(id).success) throw new HttpError(404,'Resource unavailable.'); return id; }
export async function GET(request:Request,context:Context) { try { return json(await getStaffRecord(await staff(request.headers),await idFrom(context))); } catch(error) { return failure(error); } }
export async function PATCH(request:Request,context:Context) { try { const user=await staff(request.headers); const id=await idFrom(context); const input=await parseBody(request,z.object({revisionId:z.string().uuid(),record:recordInput}).strict()); return json(await reviseRecord(user,id,input.revisionId,input.record)); } catch(error) { return failure(error); } }
export async function POST(request:Request,context:Context) { try { const user=await staff(request.headers); const id=await idFrom(context); const input=await parseBody(request,transitionInput); return json(await transitionRecord(user,id,input)); } catch(error) { return failure(error); } }
