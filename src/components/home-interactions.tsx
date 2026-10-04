'use client';

import { useState, type CSSProperties } from 'react';
import { Search, ArrowRight, Snowflake, Pause } from 'lucide-react';

export function HeroSearch() {
  return <form action="/explore" className="hero-search" role="search"><Search size={22} strokeWidth={1.6} /><label className="sr-only" htmlFor="hero-query">Search polar research</label><input id="hero-query" name="q" placeholder="What would you like to discover?" /><button type="submit">Explore <ArrowRight size={18} /></button></form>;
}

export function Snow() {
  const [paused, setPaused] = useState(false);
  return <><div className={`snow ${paused ? 'paused' : ''}`} aria-hidden="true">{Array.from({ length: 26 }, (_, i) => <i key={i} style={{ '--x': `${(i * 37 + 11) % 100}%`, '--duration': `${11 + i % 7}s`, '--delay': `${-i * 1.7}s`, '--size': `${2 + i % 3}px` } as CSSProperties} />)}</div><button className="snow-control" onClick={() => setPaused(!paused)} aria-label={paused ? 'Play snow animation' : 'Pause snow animation'}>{paused ? <Snowflake size={14} /> : <Pause size={14} />}<span>{paused ? 'Snow paused' : 'Gentle snowfall'}</span></button></>;
}
