/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F4F6F2',
        surface: '#FFFFFF',
        ink: '#14201B',
        'ink-soft': '#33413A',
        muted: '#5F6D66',
        line: '#DBE2DC',
        primary: {
          DEFAULT: '#1F5C4A',
          dark: '#164536',
          soft: '#E2EEE8',
        },
        accent: {
          DEFAULT: '#D2603A',
          soft: '#FAE8E0',
        },
        sidebar: '#11201A',
        code: '#0E1B16',
      },
      fontFamily: {
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      maxWidth: {
        prose: '68ch',
      },
      keyframes: {
        blink: {
          '0%, 45%': { opacity: '1' },
          '50%, 95%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        blink: 'blink 1.2s steps(1, end) infinite',
      },
    },
  },
  plugins: [],
};
