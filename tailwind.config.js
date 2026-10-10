/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        card: 'var(--card)',
        border: 'var(--border)',
        'border-soft': 'var(--border-soft)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',
        'accent-2': 'var(--accent-2)',
        'accent-soft': 'var(--accent-soft)',
        live: 'var(--live)',
        'live-soft': 'var(--live-soft)',
        success: 'var(--success)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'var(--radius-sm)',
      },
      boxShadow: {
        DEFAULT: 'var(--shadow)',
      },
      fontFamily: {
        mono: ["'SF Mono'", 'Menlo', 'Consolas', 'monospace'],
      },
      keyframes: {
        blink: { '50%': { opacity: '0.25' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        blink: 'blink 1.2s infinite',
        shimmer: 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
};
