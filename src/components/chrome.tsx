'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Snowflake, ArrowUpRight, Menu, X, Globe2, ArrowRight } from 'lucide-react';

const links = [['Explore', '/explore'], ['Expeditions', '/expeditions'], ['Learn', '/learn'], ['Media', '/media'], ['About', '/about']];

export function Brand() {
  return <Link href="/" className="brand" aria-label="PolarBridge home"><span className="brand-mark"><Snowflake size={25} strokeWidth={1.6} /></span><span>polar<span className="brand-light">bridge</span><small>SCIENCE WITHOUT BOUNDARIES</small></span></Link>;
}

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return <header className="site-header"><div className="header-inner"><Brand /><nav className={open ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation">{links.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={pathname.startsWith(href) ? 'page' : undefined}>{label}</Link>)}<Link className="mobile-workspace" href="/workspace" onClick={() => setOpen(false)}>Workspace <ArrowUpRight size={16} /></Link></nav><Link href="/workspace" className="workspace-link">Workspace <ArrowUpRight size={16} /></Link><button className="menu-toggle" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button></div></header>;
}

export function Footer() {
  return <footer className="site-footer"><div className="footer-top container"><div><Brand /><p>Connecting the ends of the Earth<br />to the curiosity in all of us.</p></div><div className="footer-links"><div><span>DISCOVER</span><Link href="/explore">Knowledge repository</Link><Link href="/expeditions">Polar expeditions</Link><Link href="/learn">Learning resources</Link><Link href="/outreach">Reviewed outreach stories</Link></div><div><span>CONNECT</span><Link href="/about">About PolarBridge</Link><Link href="/activities">Activities & outreach</Link><Link href="/about#credits">Image credits</Link></div></div><Link className="footer-cta" href="/explore"><Globe2 size={30} strokeWidth={1} /><span>A world of discovery.<br /><strong>Start exploring <ArrowRight size={16} /></strong></span></Link></div><div className="footer-bottom container"><span>© {new Date().getFullYear()} PolarBridge. An independent SIH prototype.</span><span>Made for curiosity. Built for our planet.</span></div></footer>;
}
