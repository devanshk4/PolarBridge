import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, ArrowRight, FileText, Database, BookOpen, BookMarked } from 'lucide-react';
import type { Resource } from '@/lib/data';

export function SectionTitle({ eyebrow, title, href, link = 'View all', children }: { eyebrow: string; title: string; href?: string; link?: string; children?: React.ReactNode }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{children && <p className="section-description">{children}</p>}</div>{href && <Link className="text-link" href={href}>{link} <ArrowUpRight size={18} /></Link>}</div>;
}

export function TypeIcon({ type, size = 17 }: { type: string; size?: number }) {
  const Icon = type === 'Dataset' ? Database : type === 'Explainer' ? BookOpen : type === 'Publication' ? BookMarked : FileText;
  return <Icon size={size} strokeWidth={1.6} />;
}

export function ResourceCard({ resource, index = 0 }: { resource: Resource; index?: number }) {
  return <Link className="resource-card" href={`/resources/${resource.slug}`}><div className={`resource-art art-${index % 3}`}><span className="resource-type"><TypeIcon type={resource.type} />{resource.type}</span><div className="art-orbit" aria-hidden="true"><div /><div /><div /></div><span className="art-label">{resource.region.toUpperCase()}<br /><strong>{resource.topic}</strong></span><ArrowUpRight className="card-arrow" size={22} /></div><div className="resource-card-body"><div className="card-meta">{resource.region}<span />{resource.year}{resource.sample && <span className="sample-label">Sample</span>}</div><h3>{resource.title}</h3><p>{resource.summary}</p><div className="card-foot"><span>{resource.sourceName.split(' • ')[0]}</span><span>{resource.readTime}</span></div></div></Link>;
}

export function StoryCard({ resource, wide = false }: { resource: Resource; wide?: boolean }) {
  return <Link href={`/resources/${resource.slug}`} className={`story-card ${wide ? 'wide' : ''}`}><div className="story-image"><Image src={resource.image} alt={resource.region === 'Arctic' ? 'Snow-covered mountains in Svalbard' : 'Antarctic mountains rising above the ocean'} fill sizes="(max-width: 700px) 100vw, 50vw" /><span className="image-pill">{resource.type === 'Explainer' ? 'POLAR SCIENCE, SIMPLIFIED' : resource.type.toUpperCase()}</span><span className="image-arrow"><ArrowUpRight size={24} /></span></div><div className="story-copy"><div className="card-meta">{resource.topic}<span />{resource.readTime}{resource.sample && <span className="sample-label">Sample article</span>}</div><h3>{resource.title}</h3><p>{resource.summary}</p></div></Link>;
}

export function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-intro container"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>;
}

export function BackLink({ href = '/explore', children = 'Back to explore' }: { href?: string; children?: React.ReactNode }) { return <Link className="back-link" href={href}><ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} />{children}</Link>; }
