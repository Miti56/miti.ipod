"use client";
import { useEffect, useRef, useState } from "react";

export type RGB = [number, number, number];

export interface AlbumPalette {
  /** 5 colors ordered dark→light: kept for potential future wave overlay use */
  waves: RGB[];
  /** 6 vivid mid-tone colors for the ambient fluid blobs */
  blobs: RGB[];
  /** Very dark tinted colour for the background radial gradient centre */
  bgMid: RGB;
  /** Near-black for the background radial gradient edge */
  bgEdge: RGB;
  /** Very light tinted colour — the solid base behind the blobs */
  bgBase: RGB;
}

// ── Fallback — soft Apple-blue/violet palette (used when no artwork) ──────────
export const DEFAULT_PALETTE: AlbumPalette = {
  waves: [
    [200, 55, 10],
    [255, 118, 32],
    [255, 188, 62],
    [255, 224, 138],
    [255, 248, 214],
  ],
  blobs: [
    [120, 155, 230],  // periwinkle blue
    [170, 120, 215],  // violet-purple
    [215, 130, 185],  // rose
    [130, 195, 215],  // sky blue
    [180, 165, 225],  // lavender
    [215, 155, 155],  // soft coral
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

// ── Palette generation from a single dominant hue ─────────────────────────────
function buildPalette(hue: number, sat: number): AlbumPalette {
  const s  = Math.max(45, Math.min(100, sat * 1.10));
  // Blob saturation: vivid enough to read on a near-white background
  const vs = Math.max(55, Math.min(88, sat * 1.08));
  const L  = 62; // base lightness for blobs — visible on light bg, not garish
  return {
    waves: [
      hslToRgb(hue, s,           28),
      hslToRgb(hue, s,           42),
      hslToRgb(hue, s * 0.90,   56),
      hslToRgb(hue, s * 0.58,   70),
      hslToRgb(hue, s * 0.26,   84),
    ],
    // Six blob colors: dominant hue + harmonious offsets within ±60°
    blobs: [
      hslToRgb(hue,       vs,          L),
      hslToRgb(hue + 28,  vs * 0.90,  L + 6),
      hslToRgb(hue - 28,  vs * 0.85,  L - 4),
      hslToRgb(hue + 55,  vs * 0.78,  L + 8),
      hslToRgb(hue - 55,  vs * 0.82,  L + 4),
      hslToRgb(hue + 14,  vs * 0.70,  L + 12),
    ],
    bgMid:  hslToRgb(hue, Math.min(70, s * 0.40), 7),
    bgEdge: hslToRgb(hue, Math.min(35, s * 0.18), 2),
    // Near-white base, very lightly tinted with the dominant hue
    bgBase: hslToRgb(hue, Math.min(22, s * 0.18), 97),
  };
}

// ── Dominant-hue extraction via hue-bucket voting ─────────────────────────────
//
// Why buckets instead of a global circular mean:
//   A global circular mean averages ALL hues together. If an album has 60% warm
//   orange and 40% cool blue, the mean lands on yellow-green — a colour that
//   appears nowhere in the image. Bucketing finds the dominant hue REGION first,
//   then computes a precise mean only within that winning region.
//
// Algorithm:
//   1. Draw artwork to a 64×64 offscreen canvas.
//   2. For each pixel compute HSL; skip near-black, near-white, and grey.
//   3. Weight each pixel by saturation × proximity-to-50%-lightness.
//   4. Accumulate weighted votes into 36 hue buckets (10° each).
//   5. Smooth bucket weights with neighbours (handles hues that straddle a bucket edge).
//   6. Find the winning bucket.
//   7. Compute a circular mean using only pixels whose hue falls within ±25° of
//      the winning bucket centre — giving a precise, uncontaminated hue value.
//   8. Build the wave palette from that hue + its average saturation.
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

      // Step 1 — fill hue buckets
      const NBUCKETS = 36;
      const DEG_PER  = 360 / NBUCKETS;
      const bWeight  = new Float32Array(NBUCKETS);
      const bSinAcc  = new Float32Array(NBUCKETS);
      const bCosAcc  = new Float32Array(NBUCKETS);
      const bSatAcc  = new Float32Array(NBUCKETS);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 128) continue;

        const [h, s, l] = rgbToHsl(r, g, b);

        // Skip near-black, near-white, and achromatic pixels
        if (l < 5 || l > 95 || s < 8) continue;

        // Weight: peaks at 50% lightness and high saturation
        const w = s * Math.max(0, 1 - Math.abs(l / 100 - 0.5) * 1.6);
        if (w <= 0) continue;

        const bi = Math.floor(h / DEG_PER) % NBUCKETS;
        bWeight[bi] += w;
        bSinAcc[bi] += Math.sin((h * Math.PI) / 180) * w;
        bCosAcc[bi] += Math.cos((h * Math.PI) / 180) * w;
        bSatAcc[bi] += s * w;
      }

      // Step 2 — smooth adjacent buckets (handles hues on bucket edges)
      const smoothed = new Float32Array(NBUCKETS);
      for (let i = 0; i < NBUCKETS; i++) {
        smoothed[i] =
          bWeight[(i - 1 + NBUCKETS) % NBUCKETS] * 0.25 +
          bWeight[i]                               * 0.50 +
          bWeight[(i + 1) % NBUCKETS]              * 0.25;
      }

      // Step 3 — find winning bucket
      let maxBucket = 0, maxW = 0;
      for (let i = 0; i < NBUCKETS; i++) {
        if (smoothed[i] > maxW) { maxW = smoothed[i]; maxBucket = i; }
      }

      if (maxW < 1) { resolve(DEFAULT_PALETTE); return; }

      // Step 4 — precise hue via circular mean of the winning bucket's pixels
      const winSin = bSinAcc[maxBucket];
      const winCos = bCosAcc[maxBucket];
      const rawH   = (Math.atan2(winSin, winCos) * 180) / Math.PI;
      const hue    = rawH < 0 ? rawH + 360 : rawH;
      const sat    = bWeight[maxBucket] > 0
        ? bSatAcc[maxBucket] / bWeight[maxBucket]
        : 70;

      resolve(buildPalette(hue, sat));
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
