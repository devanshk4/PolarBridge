import type { PoolClient } from 'pg';
import { getPool, transaction } from './db';
import { HttpError, type Staff } from './http';
import { recordInput, type RecordInput, type StaffRecord, type TransitionInput } from '../lib/record-schema';
import { validateAttachments } from './files';
import type { Resource } from '../lib/data';

const selection = `SELECT r.id,r.slug,r.owner_id,r.published_revision_id,r.updated_at,
 v.id AS revision_id,v.revision_no,v.status,v.payload,v.created_by,u.name AS owner_name
 FROM catalogue_resources r JOIN catalogue_revisions v ON v.id=r.current_revision_id
 JOIN "user" u ON u.id=r.owner_id`;

function canRead(actor: Staff, row: StaffRecord) {
  // Restricted drafts are owner-only; reviewers must never receive their contents.
  return row.owner_id === actor.id || (actor.role !== 'contributor' && row.payload.visibility !== 'restricted');
}
async function event(db: PoolClient, row: { id: string; revision_id: string }, actor: Staff, action: string, comment = '') {
  await db.query('INSERT INTO editorial_events(resource_id,revision_id,actor_id,action,comment) VALUES($1,$2,$3,$4,$5)', [row.id,row.revision_id,actor.id,action,comment]);
}
export async function listStaffRecords(actor: Staff): Promise<StaffRecord[]> {
  const result = await getPool().query(selection + ` WHERE r.owner_id=$1 OR ($2<>'contributor' AND v.payload->>'visibility'<>'restricted') ORDER BY r.updated_at DESC LIMIT 200`, [actor.id,actor.role]);
  return result.rows;
}
export async function getStaffRecord(actor: Staff, id: string) {
  const result = await getPool().query(selection + ' WHERE r.id=$1', [id]);
  const row = result.rows[0] as StaffRecord | undefined;
  if (!row || !canRead(actor,row)) throw new HttpError(404,'Resource unavailable.');
  const events = await getPool().query('SELECT action,comment,created_at FROM editorial_events WHERE resource_id=$1 ORDER BY created_at DESC LIMIT 50', [id]);
  return { ...row, events: events.rows };
}
export async function createRecord(actor: Staff, input: RecordInput, requestedSlug?: string) {
  if (actor.role !== 'contributor') throw new HttpError(403,'Only contributors can create records.');
  const payload = recordInput.parse(input);
  return transaction(async db => {
    await validateAttachments(db,actor.id,payload.attachments);
    const id = crypto.randomUUID();
    const slug = requestedSlug || `${payload.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70) || 'resource'}-${id.slice(0,8)}`;
    await db.query('INSERT INTO catalogue_resources(id,slug,owner_id) VALUES($1,$2,$3)', [id,slug,actor.id]);
    const revision_id = crypto.randomUUID();
    await db.query(`INSERT INTO catalogue_revisions(id,resource_id,revision_no,payload,created_by,status) VALUES($1,$2,1,$3,$4,'draft')`, [revision_id,id,JSON.stringify(payload),actor.id]);
    await db.query('UPDATE catalogue_resources SET current_revision_id=$2 WHERE id=$1', [id,revision_id]);
    await event(db,{id,revision_id},actor,'create');
    return {id,revision_id,slug};
  });
}
export async function reviseRecord(actor: Staff,id: string,expectedRevisionId: string,input: RecordInput) {
  const payload = recordInput.parse(input);
  return transaction(async db => {
    const result = await db.query(selection + ' WHERE r.id=$1 FOR UPDATE OF r', [id]);
    const row = result.rows[0] as StaffRecord | undefined;
    if (!row || row.owner_id !== actor.id || actor.role !== 'contributor') throw new HttpError(404,'Resource unavailable.');
    if (row.revision_id !== expectedRevisionId) throw new HttpError(409,'This record changed. Reload the latest revision.');
    if (row.status === 'in_review') throw new HttpError(409,'Wait for the review decision before revising.');
    await validateAttachments(db,actor.id,payload.attachments);
    // A separate published revision stays publicly visible until replacement publication or withdrawal.
    const revision_id = crypto.randomUUID();
    await db.query(`INSERT INTO catalogue_revisions(id,resource_id,revision_no,payload,created_by,status) VALUES($1,$2,$3,$4,$5,'draft')`, [revision_id,id,row.revision_no+1,JSON.stringify(payload),actor.id]);
    await db.query('UPDATE catalogue_resources SET current_revision_id=$2,updated_at=now() WHERE id=$1', [id,revision_id]);
    await event(db,{id,revision_id},actor,'revise');
    return {id,revision_id};
  });
}
export async function transitionRecord(actor: Staff,id: string,input: TransitionInput) {
  return transaction(async db => {
    const result = await db.query(selection + ' WHERE r.id=$1 FOR UPDATE OF r', [id]);
    const row = result.rows[0] as StaffRecord | undefined;
    if (!row || !canRead(actor,row)) throw new HttpError(404,'Resource unavailable.');
    if (row.revision_id !== input.revisionId) throw new HttpError(409,'This revision is no longer current. Reload the record.');
    let status: string;
    switch(input.action) {
      case 'submit':
        if (actor.id !== row.owner_id || actor.role !== 'contributor') throw new HttpError(403,'Only the contributor can submit this record.');
        if (row.status !== 'draft') throw new HttpError(409,'Only a draft can be submitted.');
        if (row.payload.visibility === 'restricted') throw new HttpError(422,'Restricted records stay owner-only in this milestone. Use staff visibility for editorial review.');
        await validateAttachments(db,row.owner_id,row.payload.attachments,true);
        status='in_review'; break;
      case 'approve': case 'request_changes':
        if (actor.role !== 'reviewer' || actor.id === row.created_by || actor.id === row.owner_id) throw new HttpError(403,'An independent reviewer is required.');
        if (row.status !== 'in_review') throw new HttpError(409,'This revision is not waiting for review.');
        if (input.action === 'request_changes' && !input.comment) throw new HttpError(422,'Explain the requested changes.');
        await db.query('INSERT INTO editorial_reviews(revision_id,reviewer_id,decision,comment) VALUES($1,$2,$3,$4)',[row.revision_id,actor.id,input.action === 'approve' ? 'approve':'request_changes',input.comment]);
        status=input.action === 'approve'?'approved':'changes_requested'; break;
      case 'publish': {
        if (actor.role !== 'publisher') throw new HttpError(403,'Publisher access is required.');
        if (row.status !== 'approved') throw new HttpError(409,'This exact revision must be approved before publication.');
        const approval = await db.query(`SELECT id FROM editorial_reviews WHERE revision_id=$1 AND decision='approve' AND reviewer_id<>$2`,[row.revision_id,row.created_by]);
        if (!approval.rowCount) throw new HttpError(409,'Independent approval is missing.');
        if (row.payload.visibility !== 'public' || row.payload.rights !== 'external_reference_only') throw new HttpError(422,'Release requires public visibility and confirmed external-reference rights.');
        if (row.payload.embargoUntil && new Date(row.payload.embargoUntil).getTime()>Date.now()) throw new HttpError(422,'The embargo has not ended.');
        await validateAttachments(db,row.owner_id,row.payload.attachments,true,true);
        if (row.published_revision_id) await db.query(`UPDATE catalogue_revisions SET status='superseded' WHERE id=$1`,[row.published_revision_id]);
        await db.query('UPDATE catalogue_resources SET published_revision_id=$2 WHERE id=$1',[id,row.revision_id]);
        status='published'; break;
      }
      case 'withdraw':
        if (actor.role !== 'publisher') throw new HttpError(403,'Publisher access is required.');
        if (!input.comment) throw new HttpError(422,'Add a withdrawal reason.');
        if (!row.published_revision_id) throw new HttpError(409,'No published revision exists.');
        await db.query(`UPDATE catalogue_revisions SET status='withdrawn' WHERE id=$1`,[row.published_revision_id]);
        await event(db,{id,revision_id:row.published_revision_id},actor,'withdraw',input.comment);
        await db.query('UPDATE catalogue_resources SET published_revision_id=NULL,updated_at=now() WHERE id=$1',[id]);
        return { id, status: row.published_revision_id === row.revision_id ? 'withdrawn' : row.status };
    }
    await db.query('UPDATE catalogue_revisions SET status=$2 WHERE id=$1',[row.revision_id,status]);
    await db.query('UPDATE catalogue_resources SET updated_at=now() WHERE id=$1',[id]);
    await event(db,row,actor,input.action,input.comment);
    return {id,status};
  });
}

export async function publicRecords(): Promise<Resource[]> {
  const result = await getPool().query(`SELECT r.slug,v.payload FROM catalogue_resources r
    JOIN catalogue_revisions v ON v.id=r.published_revision_id
    WHERE v.status='published' AND v.payload->>'visibility'='public'
    AND v.payload->>'rights'='external_reference_only'
    AND (v.payload->>'embargoUntil' IS NULL OR (v.payload->>'embargoUntil')::timestamptz<=now())
    ORDER BY r.updated_at DESC LIMIT 1000`);
  return result.rows.map(row => {
    const p = row.payload as RecordInput;
    return { slug: row.slug, title:p.title, type:p.type, region:p.region, year:p.year, topic:p.topic,
      attachments:p.attachments,summary:p.summary,source:p.source,sourceName:p.sourceName,readTime:p.type==='Explainer'?'Learning article':'Source reference',
      image:p.region==='Arctic'?'/images/arctic.jpg':'/images/hero.jpg',body:p.body.split(/\n\s*\n/),sample:false };
  });
}
