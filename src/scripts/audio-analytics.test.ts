import { afterEach, describe, expect, it, vi } from 'vitest';

import { AUDIO_DOWNLOAD_EVENT, audioDownloadParams, trackAudioDownloads } from './audio-analytics';

function renderLinks() {
  document.body.innerHTML = `
    <a id="audio" href="https://media.modernizedclassicsbooks.com/the-art-of-war.mp3"
       data-audio-download data-book-slug="art-of-war" data-book-title="The Art of War">
      <svg><path d="M0 0" /></svg><span>Audio, MP3</span>
    </a>
    <a id="epub" href="/downloads/art-of-war.epub" download>EPUB</a>`;
  return {
    audio: document.getElementById('audio') as HTMLAnchorElement,
    epub: document.getElementById('epub') as HTMLAnchorElement,
  };
}

function click(element: Element, init: MouseEventInit = {}, type = 'click') {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  // Keep jsdom from trying to navigate; the tracker must still see the event.
  element.addEventListener(type, (e) => e.preventDefault(), { once: true });
  element.dispatchEvent(event);
}

let stop: (() => void) | undefined;
afterEach(() => {
  stop?.();
  stop = undefined;
  document.body.innerHTML = '';
});

describe('audioDownloadParams', () => {
  it('derives the predefined GA4 file fields and the book from the link', () => {
    const { audio } = renderLinks();
    expect(audioDownloadParams(audio)).toEqual({
      link_url: 'https://media.modernizedclassicsbooks.com/the-art-of-war.mp3',
      file_name: '/the-art-of-war.mp3',
      file_extension: 'mp3',
      book_slug: 'art-of-war',
      book_title: 'The Art of War',
      transport_type: 'beacon',
    });
  });
});

describe('trackAudioDownloads', () => {
  it('sends one audio_download event per click, including clicks on the icon inside the link', () => {
    const { audio } = renderLinks();
    const gtag = vi.fn();
    stop = trackAudioDownloads(document, () => gtag);

    click(audio.querySelector('path')!);
    click(audio.querySelector('span')!);

    expect(gtag).toHaveBeenCalledTimes(2);
    expect(gtag).toHaveBeenCalledWith('event', AUDIO_DOWNLOAD_EVENT, expect.objectContaining({
      book_slug: 'art-of-war',
      file_extension: 'mp3',
    }));
  });

  it('counts a middle-click but not a right-click', () => {
    const { audio } = renderLinks();
    const gtag = vi.fn();
    stop = trackAudioDownloads(document, () => gtag);

    click(audio, { button: 1 }, 'auxclick');
    click(audio, { button: 2 }, 'auxclick');

    expect(gtag).toHaveBeenCalledTimes(1);
  });

  it('ignores other links', () => {
    const { epub } = renderLinks();
    const gtag = vi.fn();
    stop = trackAudioDownloads(document, () => gtag);

    click(epub);

    expect(gtag).not.toHaveBeenCalled();
  });

  it('does nothing, and does not throw, when gtag is missing or fails', () => {
    const { audio } = renderLinks();
    stop = trackAudioDownloads(document, () => undefined);
    expect(() => click(audio)).not.toThrow();
    stop();

    stop = trackAudioDownloads(document, () => () => {
      throw new Error('blocked by an ad blocker');
    });
    expect(() => click(audio)).not.toThrow();
  });
});
