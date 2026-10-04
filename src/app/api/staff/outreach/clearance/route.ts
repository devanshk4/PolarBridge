import { z } from 'zod';
import { staff,json,failure,parseBody } from '@/server/http';
import { clearSource } from '@/server/outreach';
export const runtime='nodejs';
export async function POST(request:Request){try{const user=await staff(request.headers);const data=await parseBody(request,z.object({revisionId:z.string().uuid(),provider:z.enum(['openai','gemini'])}).strict());await clearSource(user,data.revisionId,data.provider);return json({cleared:true});}catch(e){return failure(e);}}
