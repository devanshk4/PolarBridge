import type { Metadata } from 'next';
import { Header, Footer } from '@/components/chrome';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'PolarBridge — A window into our polar world', template: '%s | PolarBridge' },
  description: 'Explore polar expeditions, discover research, and understand the science connecting the ends of the Earth to all of us.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a><Header />{children}<Footer /></body></html>;
}
