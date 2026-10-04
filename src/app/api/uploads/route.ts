import { staff,json,failure,parseBody } from '@/server/http';
import { getPool } from '@/server/db';
import { requestUpload,fileColumns } from '@/server/files';
import { uploadInput } from '@/lib/file-schema';
export const runtime='nodejs';
export async function GET(request:Request){try{const user=await staff(request.headers);return json({files:(await getPool().query(`SELECT ${fileColumns} FROM media_files WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100`,[user.id])).rows});}catch(e){return failure(e);}}
export async function POST(request:Request){try{const user=await staff(request.headers);return json(await requestUpload(user,await parseBody(request,uploadInput)),201);}catch(e){return failure(e);}}
