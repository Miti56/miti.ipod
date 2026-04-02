"use client";
import { useEffect, useRef } from "react";
import { useAudioPlayer } from "@/hooks";
import { useAlbumColors, DEFAULT_PALETTE, RGB } from "@/hooks/audio/useAlbumColors";

// ─────────────────────────────────────────────────────────────────────────────
// Two-layer visual system:
//
// BACKGROUND — Ambient lava-lamp blobs (full viewport, heavy CSS blur).
//   Always alive. Colors lerp toward album art. No audio reactivity.
//
// FOREGROUND — iOS-style layered ocean waves (full viewport, transparent bg).
//   From commit 966a5d4a. Bass/mid spring-driven. Blurred back layers give
//   atmospheric depth. Front layers have glow. Colors from album art.
// ─────────────────────────────────────────────────────────────────────────────

const PADDING = 140; // blob canvas overshoot to hide CSS-blur edge darkening

// ── Blob config ────────────────────────────────────────────────────────────────
const BLOBS = [
  { cx:0.28, cy:0.38, rx:[0.28,0.10], ry:[0.22,0.12], sx:[0.065,0.127], sy:[0.083,0.107], radius:0.60, alpha:0.75, pi:0 },
  { cx:0.74, cy:0.60, rx:[0.24,0.09], ry:[0.28,0.11], sx:[0.078,0.113], sy:[0.071,0.139], radius:0.54, alpha:0.70, pi:1 },
  { cx:0.50, cy:0.24, rx:[0.32,0.11], ry:[0.20,0.09], sx:[0.056,0.102], sy:[0.105,0.078], radius:0.50, alpha:0.66, pi:2 },
  { cx:0.16, cy:0.74, rx:[0.20,0.09], ry:[0.32,0.10], sx:[0.094,0.089], sy:[0.058,0.121], radius:0.46, alpha:0.62, pi:3 },
  { cx:0.84, cy:0.28, rx:[0.22,0.10], ry:[0.26,0.08], sx:[0.087,0.116], sy:[0.076,0.098], radius:0.42, alpha:0.58, pi:4 },
  { cx:0.50, cy:0.78, rx:[0.26,0.08], ry:[0.24,0.12], sx:[0.103,0.081], sy:[0.091,0.118], radius:0.48, alpha:0.60, pi:5 },
] as const;

// ── Wave layer config (from 966a5d4a) ─────────────────────────────────────────
// blur   — depth blur in px (back=atmospheric, front=sharp)
// amp    — base amplitude as fraction of canvas height
// speeds — phase drift speed (rad/s) for each of 3 sine components
// freqs  — spatial frequency (cycles across width) for each component
// yFrac  — vertical centre of wave as fraction of canvas height
// alpha  — fill opacity at wave surface
// pi     — index into palette.waves (0=darkest, 4=palest)
const LAYERS = [
  { blur: 20, amp: 0.240, speeds: [0.11, 0.07, 0.04], freqs: [1.4, 2.3, 0.8],  yFrac: 0.535, alpha: 0.13, pi: 0 },
  { blur: 9,  amp: 0.185, speeds: [0.18, 0.11, 0.06], freqs: [1.9, 3.1, 1.2],  yFrac: 0.515, alpha: 0.21, pi: 1 },
  { blur: 2,  amp: 0.145, speeds: [0.26, 0.16, 0.09], freqs: [2.3, 3.8, 1.6],  yFrac: 0.500, alpha: 0.34, pi: 2 },
  { blur: 0,  amp: 0.105, speeds: [0.34, 0.21, 0.13], freqs: [2.8, 4.6, 2.1],  yFrac: 0.485, alpha: 0.50, pi: 3 },
  { blur: 0,  amp: 0.075, speeds: [0.44, 0.28, 0.17], freqs: [3.4, 5.5, 2.6],  yFrac: 0.465, alpha: 0.65, pi: 4 },
];
const W0 = 0.55, W1 = 0.30, W2 = 0.15; // sine component weights (must sum to 1)

// ── Helpers ────────────────────────────────────────────────────────────────────
interface Spr { v: number; x: number }
function spr(s: Spr, target: number, k: number, damp: number): number {
  s.v += (target - s.x) * k;
  s.v *= damp;
  s.x += s.v;
  return s.x;
}

const CL = 0.020;
function lerpRgb(a: RGB, b: RGB): RGB {
  return [
    a[0] + (b[0] - a[0]) * CL,
    a[1] + (b[1] - a[1]) * CL,
    a[2] + (b[2] - a[2]) * CL,
  ];
}
const cs = (c: RGB) => `${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])}`;

function traceCurve(ctx: CanvasRenderingContext2D, xs: Float32Array, ys: Float32Array, n: number) {
  ctx.moveTo(xs[0], ys[0]);
  for (let i = 1; i < n - 1; i++) {
    const mx = (xs[i] + xs[i + 1]) * 0.5;
    const my = (ys[i] + ys[i + 1]) * 0.5;
    ctx.quadraticCurveTo(xs[i], ys[i], mx, my);
  }
  ctx.lineTo(xs[n - 1], ys[n - 1]);
}

// ── Component ──────────────────────────────────────────────────────────────────
const EqVisualizer = () => {
  const { analyserNode, playbackInfo, nowPlayingItem } = useAudioPlayer();
  const artworkUrl = nowPlayingItem?.artwork?.url || undefined;
  const palette    = useAlbumColors(artworkUrl);

  const blobCanvasRef = useRef<HTMLCanvasElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const blobRafRef    = useRef(0);
  const waveRafRef    = useRef(0);

  // Blob Lissajous phases
  const blobPhasesRef = useRef<number[][]>(
    BLOBS.map(() => Array.from({ length: 4 }, () => Math.random() * Math.PI * 2))
  );

  // Wave layer phases: [layerIdx][componentIdx (0,1,2)]
  const wavePhasesRef = useRef<number[][]>(
    LAYERS.map(() => [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28])
  );

  // ── Colour refs (shared by both loops, lerped in wave loop) ───────────────
  const curBlobs = useRef<RGB[]>(DEFAULT_PALETTE.blobs.map(c => [...c] as RGB));
  const curBg    = useRef<RGB>([...DEFAULT_PALETTE.bgBase] as RGB);
  const tgtBlobs = useRef(curBlobs.current);
  const tgtBg    = useRef(curBg.current);

  const curWaves = useRef<RGB[]>(DEFAULT_PALETTE.waves.map(c => [...c] as RGB));
  const tgtWaves = useRef(curWaves.current);

  // ── Audio state ────────────────────────────────────────────────────────────
  const bassS     = useRef<Spr>({ v: 0, x: 0 });
  const midS      = useRef<Spr>({ v: 0, x: 0 });
  const freqRef   = useRef(new Uint8Array(1024));
  const opacRef   = useRef(0.0);
  const activeRef = useRef(false);
  const beatRef   = useRef(0);
  const prevBassR = useRef(0);

  // Keep analyserNode and playback state in refs (avoid RAF restarts)
  const analyserRef = useRef<AnalyserNode | null>(null);
  useEffect(() => { analyserRef.current = analyserNode; }, [analyserNode]);
  useEffect(() => {
    activeRef.current = playbackInfo.isPlaying && !playbackInfo.isPaused;
  }, [playbackInfo.isPlaying, playbackInfo.isPaused]);

  // Push new palette targets into refs when album art changes
  useEffect(() => {
    tgtBlobs.current = palette.blobs.map(c => [...c] as RGB);
    tgtBg.current    = [...palette.bgBase] as RGB;
    tgtWaves.current = palette.waves.map(c => [...c] as RGB);
  }, [palette]);

  // ── Blob animation loop ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = blobCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const PAD2 = PADDING * 2;
      canvas.width  = window.innerWidth  + PAD2;
      canvas.height = window.innerHeight + PAD2;
      canvas.style.width  = `${canvas.width}px`;
      canvas.style.height = `${canvas.height}px`;
    };
    resize();
    window.addEventListener("resize", resize);

    let alive   = true;
    let lastNow = performance.now();

    function frame(now: number) {
      if (!alive) return;
      blobRafRef.current = requestAnimationFrame(frame);

      const dt = Math.min((now - lastNow) / 1000, 0.05);
      lastNow = now;

      const CW = canvas!.width;
      const CH = canvas!.height;
      const VW = CW - PADDING * 2;
      const VH = CH - PADDING * 2;

      // Lerp blob colours and background toward targets
      const cb = curBlobs.current;
      const tb = tgtBlobs.current;
      for (let i = 0; i < 6; i++) cb[i] = lerpRgb(cb[i], tb[i]);
      curBg.current = lerpRgb(curBg.current, tgtBg.current);

      // Solid light background (album-art tinted near-white)
      ctx!.fillStyle = `rgb(${cs(curBg.current)})`;
      ctx!.fillRect(0, 0, CW, CH);

      // Blob orbs
      BLOBS.forEach((blob, bi) => {
        const ph = blobPhasesRef.current[bi];
        ph[0] += dt * blob.sx[0];
        ph[1] += dt * blob.sx[1];
        ph[2] += dt * blob.sy[0];
        ph[3] += dt * blob.sy[1];

        const bx = PADDING + blob.cx * VW + blob.rx[0] * VW * Math.sin(ph[0]) + blob.rx[1] * VW * Math.sin(ph[1]);
        const by = PADDING + blob.cy * VH + blob.ry[0] * VH * Math.sin(ph[2]) + blob.ry[1] * VH * Math.sin(ph[3]);
        const r   = blob.radius * Math.min(VW, VH);
        const rgb = cb[blob.pi];

        const grad = ctx!.createRadialGradient(bx, by, 0, bx, by, r);
        grad.addColorStop(0,    `rgba(${cs(rgb)}, ${blob.alpha.toFixed(3)})`);
        grad.addColorStop(0.40, `rgba(${cs(rgb)}, ${(blob.alpha * 0.40).toFixed(3)})`);
        grad.addColorStop(1,    `rgba(${cs(rgb)}, 0)`);

        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(bx, by, r, 0, Math.PI * 2);
        ctx!.fill();
      });
    }

    blobRafRef.current = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(blobRafRef.current);
      window.removeEventListener("resize", resize);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Wave animation loop ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      canvas.style.width  = `${canvas.width}px`;
      canvas.style.height = `${canvas.height}px`;
    };
    resize();
    window.addEventListener("resize", resize);

    let alive   = true;
    let lastNow = performance.now();

    const MAX_N = 512;
    const pxs   = new Float32Array(MAX_N);
    const pys   = new Float32Array(MAX_N);

    function frame(now: number) {
      if (!alive) return;
      waveRafRef.current = requestAnimationFrame(frame);

      const dt = Math.min((now - lastNow) / 1000, 0.05);
      lastNow  = now;

      const CW = canvas!.width;
      const CH = canvas!.height;
      const isActive = activeRef.current;

      // ── Opacity: gentle idle (0.22) → full when playing ──────────────────
      const targetOp = isActive ? 1.0 : 0.22;
      opacRef.current += (targetOp - opacRef.current) * 0.022;
      const op = opacRef.current;
      if (op < 0.01) { ctx!.clearRect(0, 0, CW, CH); return; }

      // ── Advance wave phases ───────────────────────────────────────────────
      LAYERS.forEach((layer, li) => {
        wavePhasesRef.current[li][0] += dt * layer.speeds[0];
        wavePhasesRef.current[li][1] += dt * layer.speeds[1];
        wavePhasesRef.current[li][2] += dt * layer.speeds[2];
      });

      // ── Frequency data ────────────────────────────────────────────────────
      const analyser = analyserRef.current;
      if (analyser && isActive) {
        analyser.getByteFrequencyData(freqRef.current);
      } else {
        for (let i = 0; i < freqRef.current.length; i++) {
          freqRef.current[i] = Math.max(0, freqRef.current[i] - 4);
        }
      }

      const avg = (lo: number, hi: number) => {
        let s = 0;
        for (let i = lo; i < hi; i++) s += freqRef.current[i];
        return s / ((hi - lo) * 255);
      };
      const bassRaw = Math.min(1, avg(1, 8)  * 2.8);
      const midRaw  = Math.min(1, avg(8, 60) * 2.2);

      const bassVal = spr(bassS.current, bassRaw, 0.10, 0.70);
      const midVal  = spr(midS.current,  midRaw,  0.10, 0.75);

      // Beat transient
      if (bassRaw - prevBassR.current > 0.12) beatRef.current = 1.0;
      beatRef.current   *= 0.90;
      prevBassR.current  = bassRaw;

      const breathe   = 1 + 0.030 * Math.sin(now * 0.00065);
      const beatBoost = 1 + beatRef.current * 0.38;

      // ── Lerp wave colours ─────────────────────────────────────────────────
      const cw = curWaves.current;
      const tw = tgtWaves.current;
      for (let i = 0; i < 5; i++) cw[i] = lerpRgb(cw[i], tw[i]);

      // ── Clear (transparent — blobs show through) ──────────────────────────
      ctx!.clearRect(0, 0, CW, CH);

      // ── Wave layers (back→front) ──────────────────────────────────────────
      LAYERS.forEach((layer, li) => {
        const ph  = wavePhasesRef.current[li];
        const rgb = cw[layer.pi];

        const STEP = layer.blur > 8 ? 14 : layer.blur > 0 ? 7 : 4;
        const N    = Math.min(Math.ceil(CW / STEP) + 2, MAX_N);

        const IDLE_FLOOR = 0.30;
        const totalAmp = layer.amp * CH * (IDLE_FLOOR + (1 - IDLE_FLOOR) * bassVal) * breathe * beatBoost;
        const midAmp   = layer.amp * CH * midVal * 0.28;
        const centerY  = CH * layer.yFrac;
        let minY = Infinity;

        for (let i = 0; i < N; i++) {
          const x  = i * STEP - STEP;
          const nx = x / CW;

          let y = W0 * Math.sin(layer.freqs[0] * Math.PI * 2 * nx + ph[0])
                + W1 * Math.sin(layer.freqs[1] * Math.PI * 2 * nx + ph[1])
                + W2 * Math.sin(layer.freqs[2] * Math.PI * 2 * nx + ph[2]);
          y *= totalAmp;
          y += midAmp * Math.sin(layer.freqs[2] * Math.PI * 5.8 * nx + ph[2] * 1.7);

          pxs[i] = x;
          pys[i] = centerY + y;
          if (pys[i] < minY) minY = pys[i];
        }

        ctx!.save();
        if (layer.blur > 0) ctx!.filter = `blur(${layer.blur}px)`;

        // Filled wave body — fades out below the surface
        const fillGrad = ctx!.createLinearGradient(0, minY - 10, 0, minY + CH * 0.62);
        fillGrad.addColorStop(0,    `rgba(${cs(rgb)}, ${layer.alpha * op})`);
        fillGrad.addColorStop(0.28, `rgba(${cs(rgb)}, ${layer.alpha * op * 0.42})`);
        fillGrad.addColorStop(0.65, `rgba(${cs(rgb)}, ${layer.alpha * op * 0.10})`);
        fillGrad.addColorStop(1,    `rgba(${cs(rgb)}, 0)`);

        ctx!.beginPath();
        traceCurve(ctx!, pxs, pys, N);
        ctx!.lineTo(pxs[N - 1], CH + 10);
        ctx!.lineTo(pxs[0] - STEP, CH + 10);
        ctx!.closePath();
        ctx!.fillStyle = fillGrad;
        ctx!.fill();

        // Bright surface line + glow on the two sharpest front layers
        if (layer.blur === 0) {
          ctx!.shadowBlur  = 22 + bassVal * 18;
          ctx!.shadowColor = `rgba(${cs(rgb)}, 0.55)`;

          ctx!.beginPath();
          traceCurve(ctx!, pxs, pys, N);
          ctx!.strokeStyle = `rgba(${cs(rgb)}, ${layer.alpha * op * 0.75})`;
          ctx!.lineWidth   = 1.8;
          ctx!.stroke();
        }

        ctx!.restore();
      });
    }

    waveRafRef.current = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(waveRafRef.current);
      window.removeEventListener("resize", resize);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Background — ambient lava-lamp blobs, heavy CSS blur */}
      <canvas
        ref={blobCanvasRef}
        style={{
          position:      "fixed",
          top:           `-${PADDING}px`,
          left:          `-${PADDING}px`,
          zIndex:        -1,
          pointerEvents: "none",
          filter:        "blur(80px) saturate(1.18)",
        }}
      />
      {/* Foreground — iOS-style layered ocean waves, transparent bg */}
      <canvas
        ref={waveCanvasRef}
        style={{
          position:      "fixed",
          top:           0,
          left:          0,
          zIndex:        0,
          pointerEvents: "none",
        }}
      />
    </>
  );
};

export default EqVisualizer;
