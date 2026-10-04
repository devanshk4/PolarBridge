import { publicRecords } from '@/server/catalogue';
import { json,failure } from '@/server/http';
export const runtime = 'nodejs';
export async function GET() { try { return json({resources:await publicRecords()}); } catch(error) { return failure(error); } }
