import Link from 'next/link';
export default function NotFound() { return <main id="main" className="container error-page"><p className="eyebrow">A LITTLE OFF THE MAP · 404</p><h1>Let’s find your way back.</h1><p>This page isn’t in our collection. There’s still plenty to discover.</p><Link href="/explore" className="button button-dark">Explore the collection</Link></main>; }
