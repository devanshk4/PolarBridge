import { createAuth } from '../src/server/auth';
import { getPool } from '../src/server/db';
import { z } from 'zod';
const input=z.object({email:z.string().email(),name:z.string().min(2),password:z.string().min(12).max(128),role:z.enum(['contributor','reviewer','publisher'])}).parse({email:process.env.STAFF_EMAIL,name:process.env.STAFF_NAME,password:process.env.STAFF_PASSWORD,role:process.env.STAFF_ROLE});
if((await getPool().query('SELECT id FROM "user" WHERE email=$1',[input.email])).rowCount) throw new Error('Account already exists; no changes made.');
const created=await createAuth(true).api.signUpEmail({body:{email:input.email,name:input.name,password:input.password}});
await getPool().query('INSERT INTO staff_members(user_id,role) VALUES($1,$2)',[created.user.id,input.role]);
console.log('Staff account provisioned. Public sign-up remains disabled.');
await getPool().end();
