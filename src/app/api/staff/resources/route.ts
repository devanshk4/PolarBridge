import { staff,json,failure,parseBody } from '@/server/http';
import { createRecord,listStaffRecords } from '@/server/catalogue';
import { recordInput } from '@/lib/record-schema';
export const runtime = 'nodejs';
export async function GET(request: Request) { try { return json({ records: await listStaffRecords(await staff(request.headers)) }); } catch(error) { return failure(error); } }
export async function POST(request: Request) { try { const user=await staff(request.headers); const input=await parseBody(request,recordInput); return json(await createRecord(user,input),201); } catch(error) { return failure(error); } }
