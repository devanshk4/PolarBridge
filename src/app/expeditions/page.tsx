import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { expeditions } from '@/lib/data';
import { PageIntro } from '@/components/ui';
export const metadata = { title: 'Explore polar regions' };
export default function ExpeditionPage() { return <main id="main"><PageIntro eyebrow="SCIENCE IN EXTRAORDINARY PLACES" title="Go a little further." description="Follow the places behind the research. Discover regional collections connecting expedition reports, scientific resources and new perspectives." /><div className="expedition-list container">{expeditions.map(e => <Link key={e.slug} href={`/expeditions/${e.slug}`} className="destination-card"><Image src={e.image} alt={`Snow and ocean illustrating the ${e.region} collection`} fill sizes="(max-width: 800px) 100vw, 33vw" /><div className="feature-shade" /><span className="destination-top">{e.coordinate}</span><div className="destination-copy"><span className="eyebrow">{e.eyebrow}</span><h2>{e.region}</h2><p>{e.description}</p><span>Explore the collection <ArrowUpRight size={17} /></span></div></Link>)}</div></main>; }
