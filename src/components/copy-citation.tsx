'use client';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
export function CopyCitation({ citation }: { citation: string }) {
  const [state, setState] = useState('');
  return <><button className="copy-button" onClick={async () => { try { await navigator.clipboard.writeText(citation); setState('Citation copied'); } catch { setState('Copy unavailable. Select and copy the source link instead.'); } }}>{state === 'Citation copied' ? <Check size={16} /> : <Copy size={16} />}{state === 'Citation copied' ? state : 'Copy reference'}</button><span role="status" className="sr-only">{state}</span></>;
}
