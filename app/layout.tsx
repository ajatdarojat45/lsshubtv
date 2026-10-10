import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import './globals.css';
import { QueryProvider } from '@/components/QueryProvider';
import { RBProvider } from '@/components/RBProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { FooterCategories } from '@/components/FooterCategories';
import { SportNav } from '@/components/SportNav';
import { LazyGutterAd } from '@/components/LazyGutterAd';
import { required } from '@/lib/env';

const contactEmail = required(process.env.RB_CONTACT_EMAIL, 'RB_CONTACT_EMAIL');

export const metadata: Metadata = {
  title: 'LSSHubTV — Live Sports',
  description: 'Live sports streaming',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <RBProvider>
            <div className="app">
              <div className="app-body">
                <aside className="gutter gutter-left" aria-label="Advertisement">
                  <div className="gutter-sticky">
                    <LazyGutterAd slotId="gutter-left" />
                  </div>
                </aside>
                <div className="app-main">
                  <header className="app-header">
                    <div className="brand">
                      <span className="brand-mark"><Trophy size={22} /></span>
                      <div className="brand-text">
                        <h1>LSSHubTV</h1>
                        <p>Live Sports Streaming</p>
                      </div>
                    </div>
                    <div className="header-actions">
                      <ThemeToggle />
                      <span className="live-chip"><span className="dot" />LIVE</span>
                    </div>
                  </header>
                  <SportNav />
                  <main className="app-content">{children}</main>
                </div>
                <aside className="gutter gutter-right" aria-label="Advertisement">
                  <div className="gutter-sticky">
                    <LazyGutterAd slotId="gutter-right" />
                  </div>
                </aside>
              </div>
              <footer className="app-footer">
                <div className="footer-grid">
                  <div className="footer-col">
                    <h3 className="footer-title">Categories</h3>
                    <FooterCategories />
                  </div>
                  <div className="footer-col">
                    <h3 className="footer-title">Contact Us</h3>
                    <ul className="footer-links">
                      <li>
                        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
                      </li>
                    </ul>
                  </div>
                  <div className="footer-col">
                    <h3 className="footer-title">Terms</h3>
                    <ul className="footer-links">
                      <li>
                        <Link href="/privacy">Privacy Policy</Link>
                      </li>
                      <li>
                        <Link href="/terms">Terms of Service</Link>
                      </li>
                    </ul>
                  </div>
                </div>
                <p>LSSHubTV 3.0.323 · Streaming via local proxy</p>
              </footer>
            </div>
          </RBProvider>
        </QueryProvider>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var stored = localStorage.getItem('rb-theme');
                var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                document.documentElement.setAttribute('data-theme', theme);
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}

