import { z } from 'zod';
import { getAuth } from './auth';
import { getPool } from './db';
export type Role = 'contributor' | 'reviewer' | 'publisher';
export type Staff = { id: string; name: string; email: string; role: Role };
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function staff(headers: Headers): Promise<Staff> {
  const session = await getAuth().api.getSession({ headers });
  if (!session) throw new HttpError(401, 'Sign in to continue.');
  const result = await getPool().query('SELECT role FROM staff_members WHERE user_id=$1 AND active=true', [session.user.id]);
  if (!result.rows[0]) throw new HttpError(403, 'Your account does not have active staff access.');
  return { id: session.user.id, name: session.user.name, email: session.user.email, role: result.rows[0].role };
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected = process.env.BETTER_AUTH_URL;
  if (!expected || origin !== new URL(expected).origin) throw new HttpError(403, 'Request origin is not allowed.');
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415, 'Use application/json.');
}
export async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  checkOrigin(request);
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'A request body is required.');
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 70000) { await reader.cancel(); throw new HttpError(413, 'This request is too large.'); } chunks.push(value); } } finally { reader.releaseLock(); }
  let input: unknown;
  try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'Invalid JSON.'); }
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message || 'Check the submitted fields.');
  return parsed.data;
}
export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export function failure(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  console.error('Backend operation failed', { name: error instanceof Error ? error.name : 'unknown', code: (error as { code?: string })?.code });
  return json({ error: 'The service is unavailable. Your change was not confirmed; please try again.' }, 503);
}
