import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { publicOutreach } from '@/server/outreach';
export const dynamic='force-dynamic';
export const metadata={title:'Reviewed outreach'};
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!z.string().uuid().safeParse(id).success)notFound();
 const [row]=await publicOutreach(id);if(!row)notFound();const p=row.payload;
 return <main id="main" className="container outreach-public"><Link className="text-link" href="/outreach">← Outreach stories</Link><article lang={p.language==='Hindi'?'hi':'en'}><span className="eyebrow">{p.format.toUpperCase()} · {p.language.toUpperCase()}</span><h1>{p.title}</h1><p className="local-note">Independently reviewed · Revision {row.version} · {p.generationId?'AI-assisted draft, reviewed by staff':'Staff-written story'}</p>{p.paragraphs.map((paragraph,i)=><section key={i}><p className="outreach-prose">{paragraph.text}</p><div className="outreach-citations">{paragraph.citations.map(c=>{const s=p.sources.find(s=>s.chunks.some(x=>x.id===c));const chunk=s?.chunks.find(x=>x.id===c);return s&&chunk?<details key={c}><summary>Evidence: {chunk.label}</summary><blockquote>{chunk.text}</blockquote><Link href={`/resources/${s.slug}`}>{s.title} · Source revision {s.revision_no} ↗</Link></details>:null;})}</div></section>)}</article><aside className="notice">This story uses approved catalogue descriptions. It does not claim to summarize the complete linked reports. Sources are checked again whenever this page is opened.</aside></main>;
}
