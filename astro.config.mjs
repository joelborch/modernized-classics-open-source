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

  /* --- Self-host fonts --- */
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Roboto',
      cssVariable: '--font-robo',
      display: 'swap',
      weights: ['400','500','700']
    },
    {
      provider: fontProviders.google(),
      name: 'Playfair Display',
      cssVariable: '--font-serif',
      display: 'swap',
      weights: ['400','500','600','700','800']
    }
  ],

  integrations: [
    react(),
    sitemap(),
    partytown({ config: { forward: ['dataLayer.push'] } })
  ]
});
