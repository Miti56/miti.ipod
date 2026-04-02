"use client";
import { useEffect, useRef, useState } from "react";

export type RGB = [number, number, number];

export interface AlbumPalette {
  /** 5 colors ordered dark→light: bass layer to treble layer */
  waves: RGB[];
  /** Very dark tinted colour for the background radial gradient centre */
  bgMid: RGB;
  /** Near-black for the background radial gradient edge */
  bgEdge: RGB;
}

// ── Fallback (warm amber — used when no artwork or extraction fails) ───────────
export const DEFAULT_PALETTE: AlbumPalette = {
  waves: [
    [200, 55, 10],
    [255, 118, 32],
    [255, 188, 62],
    [255, 224, 138],
    [255, 248, 214],
  ],
  bgMid:  [55, 16, 4],
  bgEdge: [4, 2, 1],
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
  // Boost saturation so even muted art produces vivid waves
  const s = Math.max(55, Math.min(100, sat * 1.15));
  return {
    waves: [
      hslToRgb(hue, s,            22),  // darkest  – sub-bass
      hslToRgb(hue, s,            38),  // rich     – bass
      hslToRgb(hue, s * 0.92,    55),  // vivid    – low-mid
      hslToRgb(hue, s * 0.60,    72),  // lighter  – mid
      hslToRgb(hue, s * 0.28,    88),  // pale     – treble
    ],
    bgMid:  hslToRgb(hue, Math.min(75, s * 0.45), 7),
    bgEdge: hslToRgb(hue, Math.min(40, s * 0.20), 2),
  };
}

// ── Dominant-hue extraction via weighted circular mean ────────────────────────
// Fetches artwork as a blob (avoids canvas-taint CORS restriction),
// draws it to a tiny offscreen canvas, then accumulates a saturation-weighted
// circular mean of each pixel's hue — ignoring near-black, near-white, and grey.
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

      const SIZE = 48;
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(DEFAULT_PALETTE); return; }

      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

      let sinAcc = 0, cosAcc = 0, satAcc = 0, totalW = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 128) continue;

        const [h, s, l] = rgbToHsl(r, g, b);

        // Skip near-black, near-white, and low-saturation (grey) pixels
        if (l < 8 || l > 92 || s < 12) continue;

        // Weight by saturation × distance from 50% lightness
        const w = s * (1 - Math.abs(l / 100 - 0.5) * 1.4);
        if (w <= 0) continue;

        // Circular mean (handles 0°/360° wraparound correctly)
        sinAcc += Math.sin((h * Math.PI) / 180) * w;
        cosAcc += Math.cos((h * Math.PI) / 180) * w;
        satAcc += s * w;
        totalW += w;
      }

      if (totalW < 8) { resolve(DEFAULT_PALETTE); return; }

      const rawH = (Math.atan2(sinAcc, cosAcc) * 180) / Math.PI;
      const hue = rawH < 0 ? rawH + 360 : rawH;
      const sat = satAcc / totalW;

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
