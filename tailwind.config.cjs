/** @type {import("tailwindcss").Config} */
module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  darkMode: ['selector', '[data-theme="dark"]'],
  corePlugins: {
    preflight: true,
  },
  theme: {
    fontFamily: {
      text: ['var(--font-text)', 'Georgia', 'serif'],
      ui: ['var(--font-ui)', 'system-ui', 'sans-serif'],
    },
    extend: {
      colors: {
        paper: 'var(--paper)',
        ink: {
          1: 'var(--ink-1)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
          4: 'var(--ink-4)',
          5: 'var(--ink-5)',
          6: 'var(--ink-6)',
          7: 'var(--ink-7)',
          8: 'var(--ink-8)',
          9: 'var(--ink-9)',
          10: 'var(--ink-10)',
        },
        series: {
          DEFAULT: 'var(--series)',
          ink: 'var(--series-ink)',
          tint: 'var(--series-tint)',
          rule: 'var(--series-rule)',
        },
      },
      maxWidth: {
        measure: 'var(--measure)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.2, 0, 0, 1)',
      },
    },
  },
  plugins: [],
};
