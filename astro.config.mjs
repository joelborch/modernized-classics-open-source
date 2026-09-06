import { defineConfig, fontProviders } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import react      from "@astrojs/react";
import sitemap    from "@astrojs/sitemap";
import partytown  from "@astrojs/partytown";

export default defineConfig({
  site: "https://modernizedclassicsbooks.com",

  // Preserve Astro 6's HTML whitespace behavior during the v7 migration.
  compressHTML: true,

  // Preserve the pre-v7 Markdown output while the native renderer matures.
  markdown: {
    processor: unified(),
  },

  /* --- Self-hosted fonts ---
     Literata: a serif drawn for long-form screen reading, with optical sizes,
     true italics and old-style figures. It sets every word of every edition.
     Atkinson Hyperlegible Next: the apparatus face (labels, running heads,
     controls), chosen for its legibility research rather than its style. */
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Literata',
      cssVariable: '--font-literata',
      display: 'swap',
      weights: ['200 900'],
      styles: ['normal', 'italic'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['Iowan Old Style', 'Palatino', 'Georgia', 'serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'Atkinson Hyperlegible Next',
      cssVariable: '--font-atkinson',
      display: 'swap',
      weights: ['200 800'],
      styles: ['normal', 'italic'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
  ],

  integrations: [
    react(),
    sitemap(),
    partytown({ config: { forward: ['dataLayer.push'] } })
  ]
});
