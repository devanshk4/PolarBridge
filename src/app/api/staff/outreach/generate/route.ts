import { staff,json,failure,parseBody } from '@/server/http';
import { generateOutreach } from '@/server/outreach';
import { generateInput } from '@/lib/outreach-schema';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){try{const user=await staff(request.headers);return json(await generateOutreach(user,await parseBody(request,generateInput)));}catch(e){return failure(e);}}
