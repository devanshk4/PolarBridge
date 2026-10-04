import type { PoolClient } from 'pg';
import { getPool,transaction } from './db';
import { HttpError,type Staff } from './http';
import { draftInput,generateInput,outreachAction,type Content,type Source,type OutreachRow,type OutreachPayload } from '../lib/outreach-schema';
import { aiReady,aiProvider,aiModel,aiLabel,generateDraft,promptVersion } from './outreach-ai';
import type { z } from 'zod';

const eligibility=`v.status='published' AND r.published_revision_id=v.id AND v.payload->>'visibility'='public' AND v.payload->>'rights'='external_reference_only' AND v.payload->>'type' IN ('Report','Dataset','Publication') AND (v.payload->>'embargoUntil' IS NULL OR (v.payload->>'embargoUntil')::timestamptz<=now())`;
// Public reads recheck lineage even when a dependent invalidation has not run.
const outputEligible=`EXISTS(SELECT 1 FROM outreach_sources s WHERE s.output_id=o.id) AND NOT EXISTS(SELECT 1 FROM outreach_sources s JOIN catalogue_resources r ON r.id=s.resource_id JOIN catalogue_revisions v ON v.id=s.revision_id WHERE s.output_id=o.id AND NOT (${eligibility}))`;
export async function sourceList(db:Pick<PoolClient,'query'>=getPool()):Promise<Source[]>{
 const result=await db.query(`SELECT r.id,r.slug,v.id revision_id,v.revision_no,v.payload,EXISTS(SELECT 1 FROM outreach_ai_clearance a WHERE a.revision_id=v.id AND a.provider=$1) cleared FROM catalogue_resources r JOIN catalogue_revisions v ON v.id=r.published_revision_id WHERE ${eligibility} ORDER BY r.updated_at DESC LIMIT 200`,[aiProvider()]);
 return result.rows.map(r=>({id:r.id,revision_id:r.revision_id,revision_no:r.revision_no,slug:r.slug,title:r.payload.title,source:r.payload.source,cleared:r.cleared,chunks:[{id:`${r.revision_id}:summary`,label:'Catalogue summary',text:r.payload.summary},...((r.payload.body as string).match(/[\s\S]{1,1800}/g)??[]).slice(0,6).map((text,i)=>({id:`${r.revision_id}:body${i+1}`,label:`Catalogue text · passage ${i+1}`,text}))]}));
}
async function selectedSources(ids:string[],db:Pick<PoolClient,'query'>=getPool()){
 const all=await sourceList(db);const chosen=ids.map(id=>all.find(s=>s.revision_id===id));
 if(chosen.some(s=>!s))throw new HttpError(409,'A source is no longer a current public revision. Choose sources again.');
 return chosen as Source[];
}
export function validateCitations(content:Content,sources:Source[],format:string){
 const chunks=new Set(sources.flatMap(s=>s.chunks.map(c=>c.id)));
 if(content.paragraphs.some(p=>p.citations.some(id=>!chunks.has(id))))throw new HttpError(422,'A citation does not belong to the selected source passages.');
 const length=content.paragraphs.map(p=>p.text).join('\n\n').length;
 if(length>15000 || (format==='Social caption'&&length>600))throw new HttpError(422,format==='Social caption'?'Keep social captions within 600 characters.':'Shorten this draft to 15,000 characters.');
}
export async function listOutreach(actor:Staff){return (await getPool().query(`SELECT o.*,(${outputEligible}) eligible FROM outreach_revisions o WHERE (o.owner_id=$1 OR $2<>'contributor') AND NOT EXISTS(SELECT 1 FROM outreach_revisions n WHERE n.family_id=o.family_id AND n.version>o.version) ORDER BY o.created_at DESC LIMIT 100`,[actor.id,actor.role])).rows as OutreachRow[];}
export async function getOutreach(actor:Staff,id:string){
 const result=await getPool().query(`SELECT o.*,(${outputEligible}) eligible FROM outreach_revisions o WHERE o.id=$1 AND (o.owner_id=$2 OR $3<>'contributor')`,[id,actor.id,actor.role]);
 if(!result.rows[0])throw new HttpError(404,'Draft unavailable.');
 const events=await getPool().query('SELECT action,comment,created_at FROM outreach_events WHERE output_id=$1 ORDER BY created_at DESC',[id]);
 return {...result.rows[0],events:events.rows} as OutreachRow & {events:{action:string;comment:string;created_at:string}[]};
}
export async function saveOutreach(actor:Staff,input:z.infer<typeof draftInput>){
 if(actor.role!=='contributor')throw new HttpError(403,'Only contributors can write outreach drafts.');
 const data=draftInput.parse(input);
 return transaction(async db=>{
 // Consistent source-before-output lock order also serializes source withdrawal.
 await db.query('SELECT r.id FROM catalogue_resources r JOIN catalogue_revisions v ON v.resource_id=r.id WHERE v.id=ANY($1::uuid[]) ORDER BY r.id FOR SHARE OF r',[data.sourceIds]);
 const sources=await selectedSources(data.sourceIds,db);validateCitations(data,sources,data.format);
 let family=crypto.randomUUID(),version=1;
 if(data.previousId){
 const result=await db.query('SELECT * FROM outreach_revisions WHERE id=$1 FOR UPDATE',[data.previousId]);const prior=result.rows[0] as OutreachRow|undefined;
 if(!prior||prior.owner_id!==actor.id)throw new HttpError(404,'Draft unavailable.');
 const newer=await db.query('SELECT id FROM outreach_revisions WHERE family_id=$1 AND version>$2',[prior.family_id,prior.version]);
 if(newer.rowCount||prior.status==='in_review')throw new HttpError(409,'Reload the latest draft or wait for its review.');
 family=prior.family_id;version=prior.version+1;
 }
 if(data.generationId){const run=await db.query("SELECT id FROM outreach_generation_runs WHERE id=$1 AND actor_id=$2 AND status='completed' AND source_ids=$3::jsonb",[data.generationId,actor.id,JSON.stringify(data.sourceIds)]);if(!run.rowCount)throw new HttpError(422,'Generation reference unavailable.');}
 const payload:OutreachPayload={title:data.title,paragraphs:data.paragraphs,format:data.format,language:data.language,sources,generationId:data.generationId};
 const id=crypto.randomUUID();await db.query('INSERT INTO outreach_revisions(id,family_id,version,owner_id,payload) VALUES($1,$2,$3,$4,$5)',[id,family,version,actor.id,JSON.stringify(payload)]);
 for(const s of sources)await db.query('INSERT INTO outreach_sources(output_id,resource_id,revision_id) VALUES($1,$2,$3)',[id,s.id,s.revision_id]);
 await db.query("INSERT INTO outreach_events(output_id,actor_id,action) VALUES($1,$2,'save')",[id,actor.id]);return {id};
 });
}
export async function actOutreach(actor:Staff,id:string,input:z.infer<typeof outreachAction>){
 const data=outreachAction.parse(input);
 return transaction(async db=>{
 await db.query('SELECT r.id FROM catalogue_resources r JOIN outreach_sources s ON s.resource_id=r.id WHERE s.output_id=$1 ORDER BY r.id FOR SHARE OF r',[id]);
 const result=await db.query(`SELECT o.*,(${outputEligible}) eligible FROM outreach_revisions o WHERE o.id=$1 FOR UPDATE OF o`,[id]);const row=result.rows[0] as OutreachRow|undefined;
 if(!row||(actor.role==='contributor'&&row.owner_id!==actor.id))throw new HttpError(404,'Draft unavailable.');
 const newer=await db.query('SELECT id FROM outreach_revisions WHERE family_id=$1 AND version>$2',[row.family_id,row.version]);
 if(newer.rowCount&&data.action!=='withdraw')throw new HttpError(409,'Use the latest revision.');
 if(!row.eligible&&data.action!=='withdraw'&&data.action!=='request_changes')throw new HttpError(409,'A source was replaced or withdrawn. Save a new draft with current sources.');
 let status:string;
 switch(data.action){
 case 'submit':if(actor.role!=='contributor'||actor.id!==row.owner_id)throw new HttpError(403,'Only the author can submit.');if(row.status!=='draft')throw new HttpError(409,'Save a new draft before submitting.');status='in_review';break;
 case 'approve':case 'request_changes':
 if(actor.role!=='reviewer'||actor.id===row.owner_id)throw new HttpError(403,'An independent reviewer is required.');
 if(row.status!=='in_review')throw new HttpError(409,'This draft is not awaiting review.');
 if(data.action==='approve'&&(!data.evidenceChecked||!data.languageChecked))throw new HttpError(422,'Check every claim, title, citation and language before approval.');
 if(data.action==='request_changes'&&!data.comment)throw new HttpError(422,'Explain the changes needed.');status=data.action==='approve'?'approved':'changes_requested';break;
 case 'publish':
 if(actor.role!=='publisher')throw new HttpError(403,'Publisher access is required.');if(row.status!=='approved')throw new HttpError(409,'This exact revision needs approval.');
 if(!(await db.query("SELECT id FROM outreach_events WHERE output_id=$1 AND action='approve' AND actor_id<>$2",[id,row.owner_id])).rowCount)throw new HttpError(409,'Independent approval is missing.');
 await db.query("UPDATE outreach_revisions SET status='superseded' WHERE family_id=$1 AND status='published'",[row.family_id]);status='published';break;
 case 'withdraw':if(actor.role!=='publisher')throw new HttpError(403,'Publisher access is required.');if(row.status!=='published'||!data.comment)throw new HttpError(422,'A published draft and withdrawal reason are required.');status='withdrawn';break;
 }
 await db.query('UPDATE outreach_revisions SET status=$2 WHERE id=$1',[id,status]);await db.query('INSERT INTO outreach_events(output_id,actor_id,action,comment) VALUES($1,$2,$3,$4)',[id,actor.id,data.action,data.comment]);return {id,status};
 });
}
export async function clearSource(actor:Staff,revisionId:string,provider=aiProvider()){
 if(actor.role!=='publisher')throw new HttpError(403,'Publisher access is required to clear public text for AI processing.');
 if(provider!==aiProvider())throw new HttpError(409,'AI provider changed. Refresh before clearing sources.');
 await selectedSources([revisionId]);await getPool().query('INSERT INTO outreach_ai_clearance(revision_id,cleared_by,provider) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[revisionId,actor.id,provider]);
}
export async function generateOutreach(actor:Staff,input:z.infer<typeof generateInput>){
 if(actor.role!=='contributor')throw new HttpError(403,'Only contributors can generate drafts.');
 if(!aiReady())throw new HttpError(503,'AI is not connected. Write manually while a provider is configured.');
 const data=generateInput.parse(input),sources=await selectedSources(data.sourceIds);
 if(sources.some(s=>!s.cleared))throw new HttpError(422,`A publisher must clear each source revision for ${aiLabel()} processing first.`);
 const id=crypto.randomUUID();
 await transaction(async db=>{
 await db.query("SELECT pg_advisory_xact_lock(26063)");
 const counts=await db.query("SELECT count(*) FILTER(WHERE actor_id=$1) personal,count(*) total FROM outreach_generation_runs WHERE created_at>now()-interval '24 hours'",[actor.id]);
 if(Number(counts.rows[0].personal)>=20||Number(counts.rows[0].total)>=100)throw new HttpError(429,'Daily drafting limit reached. Manual writing is still available.');
 if((await db.query("SELECT id FROM outreach_generation_runs WHERE actor_id=$1 AND status='running' AND created_at>now()-interval '2 minutes'",[actor.id])).rowCount)throw new HttpError(429,'A draft is already being generated. Please wait.');
 await db.query("INSERT INTO outreach_generation_runs(id,actor_id,model,prompt_version,source_ids,provider,status) VALUES($1,$2,$3,$4,$5,$6,'running')",[id,actor.id,aiModel(),promptVersion,JSON.stringify(data.sourceIds),aiProvider()]);
 });
 try{
 const result=await generateDraft(sources,data.format,data.language);validateCitations(result.draft,sources,data.format);
 await selectedSources(data.sourceIds);
 await getPool().query("UPDATE outreach_generation_runs SET status='completed',usage=$2,completed_at=now() WHERE id=$1",[id,JSON.stringify(result.usage)]);
 return {...result.draft,generationId:id};
 }catch(error){await getPool().query("UPDATE outreach_generation_runs SET status='failed',completed_at=now() WHERE id=$1",[id]);throw error;}
}
export async function publicOutreach(id?:string):Promise<OutreachRow[]>{return (await getPool().query(`SELECT o.* ,true eligible FROM outreach_revisions o WHERE o.status='published' AND (${outputEligible}) ${id?'AND o.id=$1':''} ORDER BY o.created_at DESC LIMIT 100`,id?[id]:[])).rows;}
export async function exportOutreach(actor:Staff,id:string){
 const row=await getOutreach(actor,id);
 if(row.status!=='published'||!row.eligible)throw new HttpError(409,'Export is available only for a current published revision with eligible sources.');
 return `# ${row.payload.title}\n\n${row.payload.language} · ${row.payload.format} · Reviewed revision ${row.version}\n\n${row.payload.paragraphs.map(p=>`${p.text}\n[Evidence: ${p.citations.join(', ')}]`).join('\n\n')}\n\nSources\n${row.payload.sources.map(s=>`${s.title} · revision ${s.revision_no}\n${s.source}`).join('\n\n')}\n\nExported ${new Date().toISOString()}. Check the live page before reuse: ${process.env.BETTER_AUTH_URL}/outreach/${id}\n`;
}
