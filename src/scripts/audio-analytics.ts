/**
 * Counts audio downloads in GA4. The MP3s live on media.modernizedclassicsbooks.com
 * and open in a new tab, so nothing else records them: the GA4 snippet runs in
 * a Partytown worker, where its automatic file-download tracking is unreliable,
 * and Cloudflare's request counts include crawlers and repeat fetches.
 *
 * Each click on a link marked `data-audio-download` sends one `audio_download`
 * event. It carries `link_url`, `file_name` and `file_extension`, which GA4
 * already reports as the predefined "Link URL", "File name" and "File
 * extension" dimensions, so a per-book breakdown works without any setup in
 * GA4. `book_slug` and `book_title` ride along for a custom dimension later.
 *
 * `gtag` is forwarded to the Partytown worker (see astro.config.mjs), so the
 * call here runs the real gtag there, which pushes a genuine `arguments`
 * object; a plain array pushed onto dataLayer is ignored by gtag.js.
 */
export type Gtag = (...args: unknown[]) => void;

export const AUDIO_DOWNLOAD_EVENT = 'audio_download';

export function audioDownloadParams(link: HTMLAnchorElement) {
  let fileName = '';
  let fileExtension = '';
  try {
    const url = new URL(link.href);
    fileName = url.pathname;
    const match = /\.([a-z0-9]+)$/i.exec(url.pathname);
    fileExtension = match ? match[1].toLowerCase() : '';
  } catch {
    /* an unparseable href still counts, just without the file fields */
  }
  return {
    link_url: link.href,
    file_name: fileName,
    file_extension: fileExtension,
    book_slug: link.dataset.bookSlug ?? '',
    book_title: link.dataset.bookTitle ?? '',
    transport_type: 'beacon',
  };
}

/**
 * Listens on `root` rather than on each link, so it works for links rendered
 * after the script runs. `auxclick` covers a middle-click, which opens the
 * file in a new tab without firing `click`.
 */
export function trackAudioDownloads(
  root: Document | HTMLElement,
  getGtag: () => Gtag | undefined = () => (window as unknown as { gtag?: Gtag }).gtag,
) {
  const handle = (event: MouseEvent) => {
    if (event.type === 'auxclick' && event.button !== 1) return;
    const target = event.target as Element | null;
    const link = target?.closest?.('a[data-audio-download]') as HTMLAnchorElement | null;
    if (!link) return;
    const gtag = getGtag();
    if (typeof gtag !== 'function') return;
    try {
      gtag('event', AUDIO_DOWNLOAD_EVENT, audioDownloadParams(link));
    } catch {
      /* analytics must never stand between a reader and the file */
    }
  };
  root.addEventListener('click', handle as EventListener);
  root.addEventListener('auxclick', handle as EventListener);
  return () => {
    root.removeEventListener('click', handle as EventListener);
    root.removeEventListener('auxclick', handle as EventListener);
  };
}
