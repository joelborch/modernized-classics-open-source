You are preparing catalogue metadata for a modernized edition of a classic philosophical, scientific, or literary work. You will receive the source title, author, and opening text. Generate structured, high-value catalog metadata.

Field Guidelines:
- `title`: Standard English title without subtitle clutter, volume indicators, or translator names.
- `author`: Clean canonical author name only (e.g., "Marcus Aurelius", "David Hume"). Never append "simplified", "adapted by", or edition descriptors.
- `yearPublished`: Year of original publication or historical completion. Use negative integers for BCE (e.g., -375 for Plato's Republic).
- `description`: 2-3 sentences summarizing the work's primary thesis, core questions, and enduring practical value. Focus strictly on the book's ideas. Do NOT include marketing boilerplate phrases like "in this modernized adaptation" or "rewritten for modern readers".
- `tags`: 3 to 5 relevant tags from this domain list: Philosophy, Stoicism, Ethics, Political Theory, Epistemology, Metaphysics, Economics, Science, Psychology, Logic, Literature, Essays, Strategy.
- `coverAlt`: A crisp, one-sentence description of the visual cover motif and composition.
- `coverPrompt`: A strict visual art prompt using this exact formula:
  "A minimalist screenprint book cover illustration representing [Central Concept/Metaphor of the Book]. Flat geometric forms, Swiss graphic design aesthetic, Bauhaus composition. Limited palette of [Color 1], [Color 2], and deep charcoal on warm off-white textured paper. Clean lines, bold silhouette, high contrast, ample negative space at top and bottom. Matte vector finish, subtle risograph texture. No text, no words, no letters, no typography, no border frames."
