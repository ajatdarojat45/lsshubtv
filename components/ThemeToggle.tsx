'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  // Render a stable placeholder until hydration completes — the server always
  // renders 'light', but the client may have 'dark' stored. Rendering the
  // stored theme before mount would mismatch the SSR HTML (hydration error).
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('rb-theme');
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
    } else {
      setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rb-theme', theme);
  }, [theme, mounted]);

  const toggle = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <button
      type="button"
      className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-full bg-panel border border-border text-muted transition-all hover:border-[#c7ccd2] hover:text-text"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {!mounted ? <Moon size={16} /> : theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
