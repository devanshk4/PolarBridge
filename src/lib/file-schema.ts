import { z } from 'zod';
export const uploadInput=z.object({
 name:z.string().trim().min(1).max(160).regex(/^[^\x00-\x1f\x7f\\/]+$/,'Use a simple filename without folders.'),
 mime:z.enum(['application/pdf','image/jpeg','image/png','image/webp']),
 size:z.number().int().positive().max(50*1024*1024),
 sha256:z.string().regex(/^[0-9a-f]{64}$/),
}).strict().superRefine((v,c)=>{if(v.mime!=='application/pdf' && v.size>20*1024*1024)c.addIssue({code:'custom',message:'Photos must be 20 MB or smaller.'});
 const ext=v.name.split('.').pop()?.toLowerCase();
 const allowed:Record<string,string[]>={'application/pdf':['pdf'],'image/jpeg':['jpg','jpeg'],'image/png':['png'],'image/webp':['webp']};
 if(!ext || !allowed[v.mime].includes(ext))c.addIssue({code:'custom',message:'The filename extension must match the selected file type.'});});
export const attachmentInput=z.object({fileId:z.string().uuid(),alt:z.string().trim().min(5).max(500),credit:z.string().trim().min(3).max(300),license:z.string().trim().min(3).max(500),publicUseAllowed:z.boolean()}).strict();
export type Attachment = z.infer<typeof attachmentInput>;
export type MediaFile={id:string;original_name:string;mime:string;byte_size:number;status:string;scan_note:string;created_at:string};
