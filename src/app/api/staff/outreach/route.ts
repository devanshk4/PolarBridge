import { staff,json,failure,parseBody } from '@/server/http';
import { listOutreach,sourceList,saveOutreach } from '@/server/outreach';
import { aiReady,aiProvider,aiLabel } from '@/server/outreach-ai';
import { draftInput } from '@/lib/outreach-schema';
export const runtime='nodejs';
export async function GET(request:Request){try{const user=await staff(request.headers);return json({drafts:await listOutreach(user),sources:await sourceList(),aiReady:aiReady(),provider:aiProvider(),providerLabel:aiLabel()});}catch(e){return failure(e);}}
export async function POST(request:Request){try{const user=await staff(request.headers);return json(await saveOutreach(user,await parseBody(request,draftInput)),201);}catch(e){return failure(e);}}
