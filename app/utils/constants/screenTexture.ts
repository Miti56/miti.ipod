/**
 * Screen texture overlay configuration.
 *
 * Place texture files in public/textures/ and set the filename below.
 * Supported formats: .jpg, .jpeg, .png, .webp
 *
 * ── Quick tuning guide ───────────────────────────────────────────────────────
 *
 * file        — swap to any file in public/textures/ (e.g. "001.webp")
 *
 * blendMode   — CSS mix-blend-mode value. Recommendations:
 *                 "screen"     → best for light scratches on a dark texture
 *                               (white lines show through, black disappears)
 *                 "multiply"   → best for dark dust/grain on a light texture
 *                               (dark marks darken content, white disappears)
 *                 "overlay"    → boosts contrast, works for mixed textures
 *                 "soft-light" → the most subtle, gentle aging effect
 *
 * opacity     — 0.0 (invisible) → 1.0 (full). 0.08–0.20 is realistic.
 *
 * contrast    — amplifies the texture's own contrast before blending.
 *               This is the main lever when using "screen": dark scratch
 *               textures are mostly black (transparent in screen mode), so
 *               cranking contrast pushes the light parts toward white and
 *               makes them visible.  1.0 = unchanged, 2.0–4.0 is useful.
 *
 * brightness  — shifts overall luminance of the texture before blending.
 *               Raise above 1.0 to lift dark textures; lower to darken bright ones.
 *
 * invert      — set true if the texture needs to be colour-inverted to look
 *               correct (e.g. dark scratches that should appear light)
 *
 * size        — CSS background-size:
 *                 "cover"   → stretches to fill, no repeat
 *                 "100% 100%" → exact fit, may distort
 *                 "200px"   → tile at fixed size
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const SCREEN_TEXTURE = {
  file: "002.jpg",
  blendMode: "screen",
  opacity: 1.0,
  contrast: 1.10,
  brightness: 1.15,
  invert: false,
  size: "cover",
} as const satisfies ScreenTextureConfig;

export interface ScreenTextureConfig {
  file: string;
  blendMode:
    | "screen"
    | "multiply"
    | "overlay"
    | "soft-light"
    | "hard-light"
    | "color-dodge"
    | "color-burn"
    | "difference"
    | "exclusion"
    | "luminosity";
  opacity: number;
  contrast: number;
  brightness: number;
  invert: boolean;
  size: string;
}
