import { staff,json,failure } from '@/server/http';
export const runtime = 'nodejs';
export async function GET(request: Request) { try { return json({ user: await staff(request.headers) }); } catch(error) { return failure(error); } }
