import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const books = defineCollection({
  loader: glob({
    base: './src/content/books',
    pattern: '**/index.md',
    generateId: ({ entry }) => entry.replace(/\/index\.md$/, ''),
  }),
  schema: ({ image }) => z.object({
    title: z.string(),
    author: z.string(),
    yearPublished: z.number().optional(),
    yearModernized: z.number().optional(),
    description: z.string().optional(),
    coverImage: image().optional(),
    coverAlt: z.string().optional(),
    tags: z.array(z.string()).optional(),
    downloads: z.object({
      epub: z.string().optional(),
    }).optional(),
    audioDownload: z.string().optional(),
  }),
});

export const collections = { books };
