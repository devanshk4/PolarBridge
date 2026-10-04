import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ArrowUpRight, Compass, FileText, Database, Camera, BookOpen, Globe2, MoveUpRight, Sparkles } from 'lucide-react';
import { HeroSearch, Snow } from '@/components/home-interactions';
import { ResourceCard, SectionTitle, StoryCard } from '@/components/ui';
import { resources } from '@/lib/data';
import { publicCollection } from '@/server/public-collection';
export const dynamic = 'force-dynamic';

export default async function Home() {
  const collection = await publicCollection();
  return <main id="main">
    <section className="hero">
      <Image className="hero-photo" src="/images/hero.jpg" alt="Snow-covered Antarctic mountains reflected in the polar ocean" fill priority sizes="100vw" quality={90} />
      <div className="hero-shade" /><Snow />
      <div className="hero-content container"><div className="hero-eyebrow"><span />A WINDOW INTO OUR POLAR WORLD</div><h1>At the ends of the Earth,<br />a world of <em>discovery.</em></h1><p>Extraordinary places. Essential science.<br />Explore the research that connects our poles to our planet.</p><HeroSearch /><div className="hero-topics"><span>Start with</span>{['Sea ice', 'Climate', 'Ocean science'].map(topic => <Link key={topic} href={`/explore?topic=${encodeURIComponent(topic)}`}>{topic}<ArrowUpRight size={12} /></Link>)}</div></div>
      <div className="hero-bottom container"><span><Compass size={16} /> ANTARCTICA <i /> A DIFFERENT PERSPECTIVE</span><a href="https://unsplash.com/photos/bu183EEgaVY" target="_blank" rel="noreferrer">Photograph by DD Wido</a></div>
    </section>

    <section className="discovery-strip container" aria-label="Explore the collections">{[{ label: 'Expedition reports', sub: 'Notes from the field', icon: FileText, href: '/explore?type=Report' }, { label: 'Scientific datasets', sub: 'Discover the evidence', icon: Database, href: '/explore?type=Dataset' }, { label: 'Stories & learning', sub: 'Big ideas, made clear', icon: BookOpen, href: '/learn' }, { label: 'Through the lens', sub: 'A closer look at the poles', icon: Camera, href: '/media' }].map(({ label, sub, icon: Icon, href }) => <Link key={label} href={href}><span className="strip-icon"><Icon size={23} strokeWidth={1.4} /></span><span><strong>{label}</strong><small>{sub}</small></span><ArrowUpRight size={17} /></Link>)}</section>

    <section className="section container"><SectionTitle eyebrow="THE KNOWLEDGE COLLECTION" title="A little curiosity goes a long way." href="/explore" link="Explore the repository">Reports, datasets and perspectives. All connected to their source.</SectionTitle><div className="resource-grid">{collection.filter(r=>!r.sample).slice(0,3).map((resource, i) => <ResourceCard key={resource.slug} resource={resource} index={i} />)}</div></section>

    <section className="expedition-section container"><div className="expedition-feature"><Image src="/images/arctic.jpg" alt="Snow-covered mountains along the Svalbard coast" fill sizes="(max-width: 800px) 100vw, 60vw" /><div className="feature-shade" /><div className="expedition-topline"><span className="glass-pill"><Compass size={14} /> FIELD NOTES</span><span>THE ARCTIC COLLECTION</span></div><div className="expedition-feature-copy"><span className="eyebrow">FAR NORTH. CLOSER THAN YOU THINK.</span><h2>Follow your curiosity<br />a little further north.</h2><p>Step into the Arctic. Explore expedition reports and the questions driving polar research.</p><Link href="/expeditions/arctic" className="button button-white">Explore the Arctic <ArrowUpRight size={18} /></Link></div></div><div className="expedition-side"><span className="eyebrow">SCIENCE IN EXTRAORDINARY PLACES</span><Globe2 className="globe-icon" size={92} strokeWidth={0.6} /><h2>Different poles.<br />One shared planet.</h2><p>From the vast Antarctic continent to the Arctic’s frozen shores, follow the places behind the research.</p><Link className="region-row" href="/expeditions/antarctica"><span><small>01 / SOUTH</small>Antarctica</span><MoveUpRight size={24} /></Link><Link className="region-row" href="/expeditions/arctic"><span><small>02 / NORTH</small>The Arctic</span><MoveUpRight size={24} /></Link><Link className="region-row" href="/expeditions/southern-ocean"><span><small>03 / CONNECTED WATERS</small>Southern Ocean</span><MoveUpRight size={24} /></Link></div></section>

    <section className="section container"><SectionTitle eyebrow="SCIENCE FOR THE CURIOUS" title="Big questions. Clearer answers." href="/learn" link="Keep learning">You don’t need to be a scientist to think like one.</SectionTitle><div className="story-grid"><StoryCard resource={resources[3]} /><StoryCard resource={resources[4]} /></div></section>

    <section className="media-band"><div className="container media-band-inner"><div><span className="eyebrow">THROUGH THE POLAR LENS</span><h2>Some stories begin<br />with a single frame.</h2><p>A glimpse of the landscapes and life that make the polar world extraordinary.</p><Link href="/media" className="text-link">Explore the gallery <ArrowUpRight size={19} /></Link><div className="media-caption"><Camera size={17} /><span>Chinstrap penguins · Two Hummock Island<br /><small>Photograph by Derek Oyen / Unsplash</small></span></div></div><Link href="/media" className="penguin-frame"><Image src="/images/penguins.jpg" alt="Chinstrap penguins standing together in Antarctic snow" fill sizes="(max-width: 700px) 100vw, 55vw" /><span className="image-arrow"><ArrowUpRight size={24} /></span></Link></div></section>

    <section className="contribute-banner container"><div className="contribute-icon"><Sparkles size={28} strokeWidth={1.3} /></div><div><span className="eyebrow">FROM RESEARCH TO UNDERSTANDING</span><h2>Great science deserves to be shared.</h2><p>Discover a workspace for connecting research with the people it matters to.</p></div><Link className="button button-dark" href="/workspace">Explore the workspace <ArrowRight size={17} /></Link></section>
  </main>;
}
