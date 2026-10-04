import Link from 'next/link';
import { PageIntro, StoryCard } from '@/components/ui';
import { publicCollection } from '@/server/public-collection';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Science for the curious' };
export default async function LearnPage() { const resources = await publicCollection(); return <main id="main"><div className="learn-intro"><PageIntro eyebrow="POLAR SCIENCE, SIMPLIFIED" title="A curious mind is all you need." description="Start with a question. Explore the ideas behind polar research, one approachable explanation at a time." /></div><div className="container learn-grid"><div className="story-grid">{resources.filter(r => r.type === 'Explainer').map(r => <StoryCard key={r.slug} resource={r} />)}</div><Link className="button button-outline" href="/outreach">Read reviewed outreach stories →</Link><div className="notice learn-note">Articles labelled as samples demonstrate the learning experience and have not undergone scientific review. Published staff contributions follow the editorial workflow.</div></div></main>; }

