"use client";
import { useEffect, useRef, useState } from "react";

export type RGB = [number, number, number];

export interface AlbumPalette {
  waves: RGB[];
  blobs: RGB[];
  bgMid: RGB;
  bgEdge: RGB;
  bgBase: RGB;
}

// ── Fallback ──────────────────────────────────────────────────────────────────
export const DEFAULT_PALETTE: AlbumPalette = {
  waves: [
    [200, 55, 10], [255, 118, 32], [255, 188, 62], [255, 224, 138], [255, 248, 214]
  ],
  blobs: [
    [120, 155, 230], [170, 120, 215], [215, 130, 185],
    [130, 195, 215], [180, 165, 225], [215, 155, 155]
  ],
  bgMid:  [55, 16, 4],
  bgEdge: [4, 2, 1],
  bgBase: [248, 245, 252],
};

// ── HSL ↔ RGB helpers ─────────────────────────────────────────────────────────
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

// ── Dynamic Palette Builder ───────────────────────────────────────────────────
function buildPalette(hue: number, bucketSat: number, avgL: number, avgS: number): AlbumPalette {
  const isDark = avgL < 40;

  // 1. Base background tracks the album's true average lightness.
  // Black albums get dark backgrounds. White albums get light backgrounds.
  const baseL = Math.max(6, Math.min(94, avgL));

  // 2. Mid and Edge gradients fade naturally from the base.
  const midL = isDark ? Math.max(2, baseL - 6) : Math.max(10, baseL - 15);
  const edgeL = isDark ? Math.max(0, baseL - 12) : Math.max(5, baseL - 25);

  // 3. Blob Lightness: Needs to contrast slightly with the background so they are visible.
  // If the background is dark (e.g., 15), blobs should be bumped to ~40.
  const blobL = isDark ? Math.min(55, baseL + 25) : Math.max(45, baseL - 15);

  // 4. Saturation: If the whole image is grey/black (avgS < 20), mute the blobs
  // so a tiny gold speck doesn't turn the whole screen neon yellow.
  const s = Math.max(10, Math.min(100, bucketSat));
  const vs = avgS < 20 ? s * 0.55 : Math.max(30, Math.min(90, s * 1.1));

  return {
    waves: [
      hslToRgb(hue, s,           28),
      hslToRgb(hue, s,           42),
      hslToRgb(hue, s * 0.90,   56),
      hslToRgb(hue, s * 0.58,   70),
      hslToRgb(hue, s * 0.26,   84),
    ],
    blobs: [
      hslToRgb(hue,       vs,          blobL),
      hslToRgb(hue + 28,  vs * 0.90,  blobL + 4),
      hslToRgb(hue - 28,  vs * 0.85,  blobL - 3),
      hslToRgb(hue + 55,  vs * 0.78,  blobL + 6),
      hslToRgb(hue - 55,  vs * 0.82,  blobL + 3),
      hslToRgb(hue + 14,  vs * 0.70,  blobL + 8),
    ],
    bgBase: hslToRgb(hue, Math.min(40, vs * 0.3), baseL),
    bgMid:  hslToRgb(hue, Math.min(50, vs * 0.4), midL),
    bgEdge: hslToRgb(hue, Math.min(60, vs * 0.5), edgeL),
  };
}

// ── Dominant-hue & True-Lightness extraction ──────────────────────────────────
async function extractPalette(url: string): Promise<AlbumPalette> {
  const blob = await fetch(url).then((r) => {
    if (!r.ok) throw new Error("artwork fetch failed");
    return r.blob();
  });
  const objUrl = URL.createObjectURL(blob);

  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objUrl);

      const SIZE = 64;
      const offscreen = document.createElement("canvas");
      offscreen.width = SIZE;
      offscreen.height = SIZE;
      const ctx = offscreen.getContext("2d");
      if (!ctx) { resolve(DEFAULT_PALETTE); return; }

      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

      const NBUCKETS = 36;
      const DEG_PER  = 360 / NBUCKETS;
      const bWeight  = new Float32Array(NBUCKETS);
      const bSinAcc  = new Float32Array(NBUCKETS);
      const bCosAcc  = new Float32Array(NBUCKETS);
      const bSatAcc  = new Float32Array(NBUCKETS);

      // Track the TRUE average lightness and saturation of the entire image
      let totalL = 0;
      let totalS = 0;
      let validPixels = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 128) continue; // skip transparent

        const [h, s, l] = rgbToHsl(r, g, b);

        totalL += l;
        totalS += s;
        validPixels++;

        // We still skip pure black/white/grey for the HUE bucket voting,
        // because we want the accent color (e.g., Gold). We've just lowered
        // the strictness so we don't miss muted accents.
        if (l < 4 || l > 96 || s < 5) continue;

        // Weight: peaks at 50% lightness and high saturation
        const w = s * Math.max(0, 1 - Math.abs(l / 100 - 0.5) * 1.6);
        if (w <= 0) continue;

        const bi = Math.floor(h / DEG_PER) % NBUCKETS;
        bWeight[bi] += w;
        bSinAcc[bi] += Math.sin((h * Math.PI) / 180) * w;
        bCosAcc[bi] += Math.cos((h * Math.PI) / 180) * w;
        bSatAcc[bi] += s * w;
      }

      // Calculate the true averages
      const avgL = validPixels > 0 ? totalL / validPixels : 50;
      const avgS = validPixels > 0 ? totalS / validPixels : 50;

      // Smooth adjacent buckets
      const smoothed = new Float32Array(NBUCKETS);
      for (let i = 0; i < NBUCKETS; i++) {
        smoothed[i] =
          bWeight[(i - 1 + NBUCKETS) % NBUCKETS] * 0.25 +
          bWeight[i]                               * 0.50 +
          bWeight[(i + 1) % NBUCKETS]              * 0.25;
      }

      // Find winning bucket
      let maxBucket = 0, maxW = 0;
      for (let i = 0; i < NBUCKETS; i++) {
        if (smoothed[i] > maxW) { maxW = smoothed[i]; maxBucket = i; }
      }

      if (maxW < 1) {
        // If literally zero color was found (pure greyscale image),
        // generate a monochrome palette based purely on average lightness.
        resolve(buildPalette(0, 0, avgL, avgS));
        return;
      }

      // Precise hue via circular mean
      const winSin = bSinAcc[maxBucket];
      const winCos = bCosAcc[maxBucket];
      const rawH   = (Math.atan2(winSin, winCos) * 180) / Math.PI;
      const hue    = rawH < 0 ? rawH + 360 : rawH;
      const bucketSat = bWeight[maxBucket] > 0
        ? bSatAcc[maxBucket] / bWeight[maxBucket]
        : 70;

      // Pass the Hue, AND the overall context of the image
      resolve(buildPalette(hue, bucketSat, avgL, avgS));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      resolve(DEFAULT_PALETTE);
    };

    img.src = objUrl;
  });
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAlbumColors(artworkUrl: string | undefined): AlbumPalette {
  const [palette, setPalette] = useState<AlbumPalette>(DEFAULT_PALETTE);
  const prevUrl = useRef<string | undefined>();

  useEffect(() => {
    if (!artworkUrl || artworkUrl === prevUrl.current) return;
    prevUrl.current = artworkUrl;

    if (artworkUrl === "") {
      setPalette(DEFAULT_PALETTE);
      return;
    }

    extractPalette(artworkUrl)
      .then(setPalette)
      .catch(() => setPalette(DEFAULT_PALETTE));
  }, [artworkUrl]);

  return palette;
}