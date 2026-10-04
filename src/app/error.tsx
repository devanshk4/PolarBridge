'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main id="main" className="container error-page"><p className="eyebrow">A SHORT PAUSE IN THE JOURNEY</p><h1>The collection is temporarily unavailable.</h1><p>We couldn’t reach the catalogue. Please try again shortly.</p><button className="button button-dark" onClick={reset}>Try again</button></main>;}
