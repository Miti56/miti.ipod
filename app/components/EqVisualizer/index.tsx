"use client";
import { useEffect, useRef } from "react";
import { useAudioPlayer } from "@/hooks";
import { useAlbumColors, DEFAULT_PALETTE, RGB } from "@/hooks/audio/useAlbumColors";

// ── Wave physics/shape config (colours are injected at runtime) ───────────────
const WAVES = [
  { binStart: 1,   binEnd: 6,   pts: 8,  maxH: 0.38, alpha: 0.65, glow: 38, k: 0.040, damp: 0.68 },
  { binStart: 6,   binEnd: 22,  pts: 10, maxH: 0.28, alpha: 0.52, glow: 28, k: 0.062, damp: 0.71 },
  { binStart: 22,  binEnd: 70,  pts: 13, maxH: 0.19, alpha: 0.40, glow: 20, k: 0.086, damp: 0.73 },
  { binStart: 70,  binEnd: 160, pts: 16, maxH: 0.13, alpha: 0.30, glow: 14, k: 0.110, damp: 0.76 },
  { binStart: 160, binEnd: 340, pts: 20, maxH: 0.08, alpha: 0.20, glow: 8,  k: 0.150, damp: 0.79 },
] as const;

// ── Spring physics ─────────────────────────────────────────────────────────────
interface Spring { v: number; x: number }

const initSprings = (): Spring[][] =>
  WAVES.map((w) => Array.from({ length: w.pts }, () => ({ v: 0, x: 0 })));

function tickSpring(s: Spring, target: number, k: number, damp: number) {
  s.v += (target - s.x) * k;
  s.v *= damp;
  s.x += s.v;
}

// ── Smooth bezier path ─────────────────────────────────────────────────────────
function drawWavePath(
  ctx: CanvasRenderingContext2D,
  xs: number[], ys: number[],
  baseline: number, W: number
) {
  ctx.beginPath();
  ctx.moveTo(-12, baseline);
  ctx.lineTo(xs[0], ys[0]);
  for (let i = 0; i < xs.length - 1; i++) {
    const mx = (xs[i] + xs[i + 1]) / 2;
    const my = (ys[i] + ys[i + 1]) / 2;
    ctx.quadraticCurveTo(xs[i], ys[i], mx, my);
  }
  ctx.lineTo(xs[xs.length - 1], ys[xs.length - 1]);
  ctx.lineTo(W + 12, baseline);
  ctx.closePath();
}

// ── Colour lerp helpers ────────────────────────────────────────────────────────
const LERP = 0.038; // colour transition speed per frame (~60fps → ~1.5s transition)

function lerpChannel(a: number, b: number): number {
  return a + (b - a) * LERP;
}

function lerpRgb(cur: RGB, tgt: RGB): RGB {
  return [
    lerpChannel(cur[0], tgt[0]),
    lerpChannel(cur[1], tgt[1]),
    lerpChannel(cur[2], tgt[2]),
  ];
}

function rgbStr(c: RGB): string {
  return `${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])}`;
}

// ── Palette state stored as mutable refs (avoids restarting the RAF loop) ─────
interface LivePalette {
  waves:  RGB[];
  bgMid:  RGB;
  bgEdge: RGB;
}

function clonePalette(p: typeof DEFAULT_PALETTE): LivePalette {
  return {
    waves:  p.waves.map((c) => [...c] as RGB),
    bgMid:  [...p.bgMid]  as RGB,
    bgEdge: [...p.bgEdge] as RGB,
  };
}

// ── Component ──────────────────────────────────────────────────────────────────
const EqVisualizer = () => {
  const { analyserNode, playbackInfo, nowPlayingItem } = useAudioPlayer();
  const artworkUrl = nowPlayingItem?.artwork?.url ?? "";

  // Extract palette from artwork; falls back to warm amber when no art
  const palette = useAlbumColors(artworkUrl || undefined);

  // Refs so the animation loop can read latest values without restarting
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const rafRef       = useRef<number>(0);
  const springsRef   = useRef<Spring[][]>(initSprings());
  const freqRef      = useRef<Uint8Array>(new Uint8Array(1024));
  const opacRef      = useRef(0);
  const activeRef    = useRef(false);
  const targetRef    = useRef<LivePalette>(clonePalette(DEFAULT_PALETTE));
  const currentRef   = useRef<LivePalette>(clonePalette(DEFAULT_PALETTE));

  // Keep active state in a ref (avoid restarting animation loop on every tick)
  useEffect(() => {
    activeRef.current = playbackInfo.isPlaying && !playbackInfo.isPaused;
  }, [playbackInfo.isPlaying, playbackInfo.isPaused]);

  // Push new palette into the target ref so the loop lerps toward it
  useEffect(() => {
    targetRef.current = clonePalette(palette);
  }, [palette]);

  // ── Animation loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    let alive = true;

    function frame() {
      if (!alive) return;
      rafRef.current = requestAnimationFrame(frame);

      const W = canvas!.width;
      const H = canvas!.height;
      const isActive = activeRef.current;

      // Fade in / out
      opacRef.current = isActive
        ? Math.min(1, opacRef.current + 0.022)
        : Math.max(0, opacRef.current - 0.014);

      if (opacRef.current < 0.005) {
        ctx!.clearRect(0, 0, W, H);
        return;
      }

      // Smooth-lerp every colour channel toward the target palette
      const cur = currentRef.current;
      const tgt = targetRef.current;
      for (let i = 0; i < 5; i++) cur.waves[i]  = lerpRgb(cur.waves[i],  tgt.waves[i]);
      cur.bgMid  = lerpRgb(cur.bgMid,  tgt.bgMid);
      cur.bgEdge = lerpRgb(cur.bgEdge, tgt.bgEdge);

      // Pull frequency data
      if (analyserNode && isActive) {
        analyserNode.getByteFrequencyData(freqRef.current);
      } else {
        for (let i = 0; i < freqRef.current.length; i++) {
          freqRef.current[i] = Math.max(0, freqRef.current[i] - 5);
        }
      }

      ctx!.clearRect(0, 0, W, H);

      const op  = opacRef.current;
      const cx  = W / 2;
      const baseline = H * 0.55;

      // ── Background radial gradient (colours from album art) ───────────────
      const bg = ctx!.createRadialGradient(cx, baseline, 0, cx, baseline, Math.max(W, H) * 0.72);
      bg.addColorStop(0, `rgba(${rgbStr(cur.bgMid)},  ${op * 0.88})`);
      bg.addColorStop(1, `rgba(${rgbStr(cur.bgEdge)}, ${op})`);
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, W, H);

      // ── Wave layers ────────────────────────────────────────────────────────
      WAVES.forEach((wCfg, wi) => {
        const springs = springsRef.current[wi];
        const { pts, binStart, binEnd, maxH, alpha, glow, k, damp } = wCfg;
        const rgb = cur.waves[wi];
        const binSpan = binEnd - binStart;

        const xs: number[] = [];
        const ys: number[] = [];

        for (let i = 0; i < pts; i++) {
          const x    = (i / (pts - 1)) * (W + 100) - 50;
          const frac = i / (pts - 1);
          const binIdx = Math.min(
            Math.round(binStart + frac * binSpan),
            freqRef.current.length - 1
          );
          const raw    = freqRef.current[binIdx] / 255;
          const env    = Math.sin(Math.PI * frac);   // bell-curve envelope
          const target = raw * env * maxH * H;

          tickSpring(springs[i], target, k, damp);
          xs.push(x);
          ys.push(baseline - springs[i].x);
        }

        // Main filled wave with vertical gradient
        const fillGrad = ctx!.createLinearGradient(0, baseline - maxH * H, 0, baseline);
        fillGrad.addColorStop(0, `rgba(${rgbStr(rgb)}, ${alpha * op})`);
        fillGrad.addColorStop(1, `rgba(${rgbStr(rgb)}, 0)`);

        ctx!.save();
        ctx!.shadowBlur  = glow;
        ctx!.shadowColor = `rgba(${rgbStr(rgb)}, 0.75)`;
        drawWavePath(ctx!, xs, ys, baseline, W);
        ctx!.fillStyle = fillGrad;
        ctx!.fill();
        ctx!.restore();

        // Reflection (mirrored below baseline, fades to transparent)
        const refYs    = ys.map((y) => baseline + (baseline - y) * 0.45);
        const refGrad  = ctx!.createLinearGradient(0, baseline, 0, baseline + maxH * H * 0.45);
        refGrad.addColorStop(0, `rgba(${rgbStr(rgb)}, ${alpha * 0.22 * op})`);
        refGrad.addColorStop(1, `rgba(${rgbStr(rgb)}, 0)`);
        drawWavePath(ctx!, xs, refYs, baseline, W);
        ctx!.fillStyle = refGrad;
        ctx!.fill();
      });

      // ── Edge vignette ──────────────────────────────────────────────────────
      const vig = ctx!.createRadialGradient(cx, H / 2, H * 0.18, cx, H / 2, H * 0.78);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, `rgba(0,0,0,${0.48 * op})`);
      ctx!.fillStyle = vig;
      ctx!.fillRect(0, 0, W, H);
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [analyserNode]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }}
    />
  );
};

export default EqVisualizer;
