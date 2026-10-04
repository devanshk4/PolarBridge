import { getAuth } from '@/server/auth';
import { failure } from '@/server/http';
export const runtime = 'nodejs';
async function handler(request: Request) {
  try { return await getAuth().handler(request); } catch(error) { return failure(error); }
}
export const GET = handler;
export const POST = handler;
