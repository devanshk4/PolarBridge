import { Suspense } from 'react';
import { Explore } from '@/components/explore';
import { PageIntro } from '@/components/ui';
import { publicCollection } from '@/server/public-collection';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Explore the collection' };
export default async function ExplorePage() { const resources = await publicCollection(); return <main id="main"><PageIntro eyebrow="THE KNOWLEDGE REPOSITORY" title="Follow your curiosity." description="A collection of research, reports and ideas from the polar world. Find a starting point. See where it takes you." /><Suspense fallback={<div className="container loading-state">Opening the collection…</div>}><Explore resources={resources} /></Suspense></main>; }
