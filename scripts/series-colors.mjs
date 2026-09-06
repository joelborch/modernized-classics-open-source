#!/usr/bin/env node
// Samples one "series colour" per edition from its cover art and writes
// src/data/series-colors.json. The site uses that colour for the edition's
// running-head rule, bookmark ribbon, and chapter ticks.
//
// Run `npm run series-colors` after adding a cover. The build never calls
// this script, so builds stay pure; a book without an entry falls back to ink.
//
// Self-contained PNG decoder (8-bit RGB/RGBA/greyscale, non-interlaced) so
// the repository does not need an image library for this.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

const booksDir = join(process.cwd(), 'src', 'content', 'books');
const outFile = join(process.cwd(), 'src', 'data', 'series-colors.json');

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  let palette = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'PLTE') {
      palette = data;
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  if (bitDepth !== 8 || interlace !== 0) throw new Error(`unsupported PNG (bit depth ${bitDepth}, interlace ${interlace})`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`unsupported colour type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let inPos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[inPos++];
    const rowStart = y * stride;
    const prevStart = rowStart - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[rowStart + x - channels] : 0;
      const b = y > 0 ? out[prevStart + x] : 0;
      const c = (x >= channels && y > 0) ? out[prevStart + x - channels] : 0;
      const v = raw[inPos++];
      let val;
      switch (filter) {
        case 0: val = v; break;
        case 1: val = v + a; break;
        case 2: val = v + b; break;
        case 3: val = v + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          val = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`bad filter ${filter}`);
      }
      out[rowStart + x] = val & 0xff;
    }
  }
  return { width, height, channels, colorType, palette, data: out };
}

function rgbAt(img, x, y) {
  const i = (y * img.width + x) * img.channels;
  const d = img.data;
  switch (img.colorType) {
    case 0: case 4: return [d[i], d[i], d[i]];
    case 3: { const p = d[i] * 3; return [img.palette[p], img.palette[p + 1], img.palette[p + 2]]; }
    default: return [d[i], d[i + 1], d[i + 2]];
  }
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

// Pick the most present saturated hue, then normalise lightness so the colour
// works as ink on light paper and as a rule on dark paper (the site derives
// the theme variants from this single value).
function seriesColor(img) {
  const bins = new Map();
  const step = Math.max(1, Math.floor(Math.min(img.width, img.height) / 96));
  for (let y = 0; y < img.height; y += step) {
    for (let x = 0; x < img.width; x += step) {
      const [r, g, b] = rgbAt(img, x, y);
      const [h, s, l] = rgbToHsl(r, g, b);
      if (s < 0.28 || l < 0.12 || l > 0.9) continue;
      const key = Math.round(h / 12) * 12;
      const entry = bins.get(key) || { weight: 0, h: 0, s: 0, l: 0 };
      const w = s * (1 - Math.abs(l - 0.5));
      entry.weight += w; entry.h += h * w; entry.s += s * w; entry.l += l * w;
      bins.set(key, entry);
    }
  }
  if (bins.size === 0) return null;
  const best = [...bins.values()].sort((a, b) => b.weight - a.weight)[0];
  const h = best.h / best.weight;
  const s = Math.min(0.72, Math.max(0.42, best.s / best.weight));
  const l = 0.38;
  return hslToHex(h, s, l);
}

const result = {};
for (const slug of readdirSync(booksDir).sort()) {
  const cover = join(booksDir, slug, 'cover.png');
  if (!existsSync(cover)) continue;
  try {
    const img = decodePng(readFileSync(cover));
    const hex = seriesColor(img);
    if (hex) result[slug] = hex;
    console.log(`${slug.padEnd(44)} ${hex ?? 'no saturated colour'}`);
  } catch (error) {
    console.error(`${slug}: ${error.message}`);
  }
}
writeFileSync(outFile, JSON.stringify(result, null, 2) + '\n');
console.log(`wrote ${outFile}`);
