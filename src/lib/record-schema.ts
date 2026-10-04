import { z } from 'zod';
import { attachmentInput } from './file-schema';
export const recordInput = z.object({
  title: z.string().trim().min(5, 'Use a title of at least 5 characters.').max(180),
  summary: z.string().trim().min(20, 'Add a description of at least 20 characters.').max(3000),
  body: z.string().trim().min(20, 'Add at least 20 characters of content.').max(30000),
  type: z.enum(['Report', 'Dataset', 'Publication', 'Explainer']),
  region: z.enum(['Arctic', 'Antarctica', 'Southern Ocean']),
  topic: z.enum(['Sea ice', 'Climate', 'Ocean science', 'Atmosphere']),
  year: z.number().int().min(1900).max(2100),
  source: z.string().url('Enter the original source URL.').max(2000).refine(s => new URL(s).protocol === 'https:', 'Use an HTTPS source URL.'),
  sourceName: z.string().trim().min(3).max(200),
  visibility: z.enum(['public', 'staff', 'restricted']),
  rights: z.enum(['external_reference_only', 'unknown']),
  attachments: z.array(attachmentInput).max(8).refine(a=>new Set(a.map(f=>f.fileId)).size===a.length,'Do not attach the same file twice.').optional(),
  embargoUntil: z.string().datetime({ offset: true }).nullable(),
}).strict();
export type RecordInput = z.infer<typeof recordInput>;
export const transitionInput = z.object({
  action: z.enum(['submit', 'approve', 'request_changes', 'publish', 'withdraw']),
  revisionId: z.string().uuid(),
  comment: z.string().trim().max(2000).default(''),
}).strict();
export type TransitionInput = z.infer<typeof transitionInput>;
export type StaffRecord = {
  id: string; slug: string; owner_id: string; revision_id: string; revision_no: number;
  status: string; payload: RecordInput; created_by: string; published_revision_id: string | null;
  owner_name: string; updated_at: string;
};
