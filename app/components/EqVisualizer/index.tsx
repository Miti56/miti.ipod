"use client";
import { useEffect, useRef } from "react";
import { useAudioPlayer } from "@/hooks";
import { useAlbumColors, DEFAULT_PALETTE, RGB } from "@/hooks/audio/useAlbumColors";

// ─────────────────────────────────────────────────────────────────────────────
// Two-layer visual system:
//
// BACKGROUND — Ambient lava-lamp blobs (full viewport, heavy CSS blur).
// FOREGROUND — iOS-style layered ocean waves. Bass/mid spring-driven.
//
// MATH: Uses dtScale for perfect rhythm synchronization across 30Hz/60Hz/120Hz
// displays without the CPU overhead of a fixed-timestep while loop.
// ─────────────────────────────────────────────────────────────────────────────

const PADDING = 140;

// ── Blob config ────────────────────────────────────────────────────────────────
const BLOBS = [
  { cx:0.28, cy:0.38, rx:[0.28,0.10], ry:[0.22,0.12], sx:[0.065,0.127], sy:[0.083,0.107], radius:0.60, alpha:0.75, pi:0 },
  { cx:0.74, cy:0.60, rx:[0.24,0.09], ry:[0.28,0.11], sx:[0.078,0.113], sy:[0.071,0.139], radius:0.54, alpha:0.70, pi:1 },
  { cx:0.50, cy:0.24, rx:[0.32,0.11], ry:[0.20,0.09], sx:[0.056,0.102], sy:[0.105,0.078], radius:0.50, alpha:0.66, pi:2 },
  { cx:0.16, cy:0.74, rx:[0.20,0.09], ry:[0.32,0.10], sx:[0.094,0.089], sy:[0.058,0.121], radius:0.46, alpha:0.62, pi:3 },
  { cx:0.84, cy:0.28, rx:[0.22,0.10], ry:[0.26,0.08], sx:[0.087,0.116], sy:[0.076,0.098], radius:0.42, alpha:0.58, pi:4 },
  { cx:0.50, cy:0.78, rx:[0.26,0.08], ry:[0.24,0.12], sx:[0.103,0.081], sy:[0.091,0.118], radius:0.48, alpha:0.60, pi:5 },
] as const;

// ── Wave layer config ─────────────────────────────────────────────────────────
const LAYERS = [
  { blur: 20, amp: 0.240, speeds: [0.11, 0.07, 0.04], freqs: [1.4, 2.3, 0.8],  yFrac: 0.535, alpha: 0.13, pi: 0 },
  { blur: 9,  amp: 0.185, speeds: [0.18, 0.11, 0.06], freqs: [1.9, 3.1, 1.2],  yFrac: 0.515, alpha: 0.21, pi: 1 },
  { blur: 2,  amp: 0.145, speeds: [0.26, 0.16, 0.09], freqs: [2.3, 3.8, 1.6],  yFrac: 0.500, alpha: 0.34, pi: 2 },
  { blur: 0,  amp: 0.105, speeds: [0.34, 0.21, 0.13], freqs: [2.8, 4.6, 2.1],  yFrac: 0.485, alpha: 0.50, pi: 3 },
  { blur: 0,  amp: 0.075, speeds: [0.44, 0.28, 0.17], freqs: [3.4, 5.5, 2.6],  yFrac: 0.465, alpha: 0.65, pi: 4 },
];
const W0 = 0.55, W1 = 0.30, W2 = 0.15;

// ── Helpers (Upgraded for dtScale) ─────────────────────────────────────────────
interface Spr { v: number; x: number }
function spr(s: Spr, target: number, k: number, damp: number, dtScale: number): number {
  s.v += (target - s.x) * (k * dtScale);
  s.v *= Math.pow(damp, dtScale); // Exponential decay based on time passed
  s.x += s.v * dtScale;
  return s.x;
}

function lerpRgb(a: RGB, b: RGB, dtScale: number): RGB {
  const cl = 0.020 * dtScale;
  return [
    a[0] + (b[0] - a[0]) * cl,
    a[1] + (b[1] - a[1]) * cl,
    a[2] + (b[2] - a[2]) * cl,
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
  const rafRef        = useRef(0);

  const blobPhasesRef = useRef<number[][]>(
    BLOBS.map(() => Array.from({ length: 4 }, () => Math.random() * Math.PI * 2))
  );

  const wavePhasesRef = useRef<number[][]>(
    LAYERS.map(() => [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28])
  );

  const curBlobs = useRef<RGB[]>(DEFAULT_PALETTE.blobs.map(c => [...c] as RGB));
  const curBg    = useRef<RGB>([...DEFAULT_PALETTE.bgBase] as RGB);
  const tgtBlobs = useRef(curBlobs.current);
  const tgtBg    = useRef(curBg.current);

  const curWaves = useRef<RGB[]>(DEFAULT_PALETTE.waves.map(c => [...c] as RGB));
  const tgtWaves = useRef(curWaves.current);

  const bassS     = useRef<Spr>({ v: 0, x: 0 });
  const midS      = useRef<Spr>({ v: 0, x: 0 });
  const bassFloor = useRef(0);
  const midFloor  = useRef(0);
  const freqRef   = useRef(new Uint8Array(1024));
  const opacRef   = useRef(0.0);
  const activeRef = useRef(false);
  const beatRef   = useRef(0);
  const prevBassR = useRef(0);

  const analyserRef = useRef<AnalyserNode | null>(null);
  useEffect(() => { analyserRef.current = analyserNode; }, [analyserNode]);
  useEffect(() => {
    activeRef.current = playbackInfo.isPlaying && !playbackInfo.isPaused;
  }, [playbackInfo.isPlaying, playbackInfo.isPaused]);

  useEffect(() => {
    tgtBlobs.current = palette.blobs.map(c => [...c] as RGB);
    tgtBg.current    = [...palette.bgBase] as RGB;
    tgtWaves.current = palette.waves.map(c => [...c] as RGB);
  }, [palette]);

  // ── Unified Animation Loop ─────────────────────────────────────────────────
  useEffect(() => {
    const bCanvas = blobCanvasRef.current;
    const wCanvas = waveCanvasRef.current;
    if (!bCanvas || !wCanvas) return;
    const bCtx = bCanvas.getContext("2d");
    const wCtx = wCanvas.getContext("2d");
    if (!bCtx || !wCtx) return;

    const DOWNSCALE = 0.2;
    const isMobileRef = { current: window.innerWidth <= 576 };

    const resize = () => {
      isMobileRef.current = window.innerWidth <= 768;

      // Revert wave canvas to standard 1:1 dimensions
      wCanvas.width  = window.innerWidth;
      wCanvas.height = window.innerHeight;
      wCanvas.style.width  = `${window.innerWidth}px`;
      wCanvas.style.height = `${window.innerHeight}px`;

      const PAD2 = PADDING * 2;
      bCanvas.width  = (window.innerWidth + PAD2) * DOWNSCALE;
      bCanvas.height = (window.innerHeight + PAD2) * DOWNSCALE;
      bCanvas.style.width  = `${window.innerWidth + PAD2}px`;
      bCanvas.style.height = `${window.innerHeight + PAD2}px`;
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
      rafRef.current = requestAnimationFrame(frame);

      // Get delta time (capped at 20fps equivalent so tabs don't explode when sleeping)
      const dt = Math.min((now - lastNow) / 1000, 0.05);
      lastNow  = now;

      // Calculate a multiplier. At 60fps, dtScale is 1.0. At 30fps, dtScale is 2.0.
      const dtScale = dt * 60;

      const isActive = activeRef.current;
      const blobTarget = isActive ? tgtBlobs.current : DEFAULT_PALETTE.blobs as RGB[];
      const bgTarget   = isActive ? tgtBg.current    : DEFAULT_PALETTE.bgBase as RGB;
      const waveTarget = isActive ? tgtWaves.current : DEFAULT_PALETTE.waves as RGB[];

      const cb = curBlobs.current;
      for (let i = 0; i < 6; i++) cb[i] = lerpRgb(cb[i], blobTarget[i] ?? blobTarget[blobTarget.length - 1], dtScale);
      curBg.current = lerpRgb(curBg.current, bgTarget, dtScale);

      const cw = curWaves.current;
      for (let i = 0; i < 5; i++) cw[i] = lerpRgb(cw[i], waveTarget[i], dtScale);

      // ── Blob Background ───────────────────────────────────────────────────
      const lCW = window.innerWidth + PADDING * 2;
      const lCH = window.innerHeight + PADDING * 2;
      const lVW = window.innerWidth;
      const lVH = window.innerHeight;

      bCtx!.save();
      bCtx!.scale(DOWNSCALE, DOWNSCALE);
      bCtx!.fillStyle = `rgb(${cs(curBg.current)})`;
      bCtx!.fillRect(0, 0, lCW, lCH);

      BLOBS.forEach((blob, bi) => {
        const ph = blobPhasesRef.current[bi];
        ph[0] += dt * blob.sx[0];
        ph[1] += dt * blob.sx[1];
        ph[2] += dt * blob.sy[0];
        ph[3] += dt * blob.sy[1];

        const bx  = PADDING + blob.cx * lVW + blob.rx[0] * lVW * Math.sin(ph[0]) + blob.rx[1] * lVW * Math.sin(ph[1]);
        const by  = PADDING + blob.cy * lVH + blob.ry[0] * lVH * Math.sin(ph[2]) + blob.ry[1] * lVH * Math.sin(ph[3]);
        const r   = blob.radius * Math.min(lVW, lVH);
        const rgb = cb[blob.pi];

        const grad = bCtx!.createRadialGradient(bx, by, 0, bx, by, r);
        grad.addColorStop(0,    `rgba(${cs(rgb)}, ${blob.alpha.toFixed(3)})`);
        grad.addColorStop(0.40, `rgba(${cs(rgb)}, ${(blob.alpha * 0.40).toFixed(3)})`);
        grad.addColorStop(1,    `rgba(${cs(rgb)}, 0)`);

        bCtx!.fillStyle = grad;
        bCtx!.beginPath();
        bCtx!.arc(bx, by, r, 0, Math.PI * 2);
        bCtx!.fill();
      });
      bCtx!.restore();

      // ── Wave Foreground ─────────────────────────────────────────────────
      // @ts-ignore
      const wCW = wCanvas.width;
      // @ts-ignore
      const wCH = wCanvas.height;

      const targetOp = isActive ? 1.0 : 0.22;
      opacRef.current += (targetOp - opacRef.current) * (0.022 * dtScale);
      const op = opacRef.current;

      wCtx!.clearRect(0, 0, wCW, wCH);

      if (op >= 0.01) {
        LAYERS.forEach((layer, li) => {
          wavePhasesRef.current[li][0] += dt * layer.speeds[0];
          wavePhasesRef.current[li][1] += dt * layer.speeds[1];
          wavePhasesRef.current[li][2] += dt * layer.speeds[2];
        });

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

        const rawB = avg(1, 8);
        const rawM = avg(8, 60);

        // Floor scales with time
        bassFloor.current += (rawB - bassFloor.current) * (rawB > bassFloor.current ? 0.005 : 0.02) * dtScale;
        midFloor.current  += (rawM - midFloor.current)  * (rawM > midFloor.current  ? 0.005 : 0.02) * dtScale;

        const bassRaw = Math.min(1, Math.max(0, rawB - bassFloor.current) * 3.5);
        const midRaw  = Math.min(1, Math.max(0, rawM - midFloor.current) * 3.0);

        // Pass dtScale to the springs to keep tension accurate at all framerates
        const bassVal = spr(bassS.current, bassRaw, 0.15, 0.65, dtScale);
        const midVal  = spr(midS.current,  midRaw,  0.15, 0.70, dtScale);

        if (bassRaw - prevBassR.current > 0.15) beatRef.current = 1.0;

        // Decay exponentially over time, not frames
        beatRef.current *= Math.pow(0.90, dtScale);
        prevBassR.current = bassRaw;

        const breathe   = 1 + 0.030 * Math.sin(now * 0.00065);
        const beatBoost = 1 + beatRef.current * 0.38;

        LAYERS.forEach((layer, li) => {
          const ph  = wavePhasesRef.current[li];
          const rgb = cw[layer.pi];

          // Revert back to original STEP math to fix aliasing/desync
          const STEP = layer.blur > 8 ? 14 : layer.blur > 0 ? 7 : 4;
          const N    = Math.min(Math.ceil(wCW / STEP) + 2, MAX_N);

          const IDLE_FLOOR = 0.30;
          const totalAmp = layer.amp * wCH * (IDLE_FLOOR + (1 - IDLE_FLOOR) * bassVal) * breathe * beatBoost;
          const midAmp   = layer.amp * wCH * midVal * 0.28;
          const centerY  = wCH * layer.yFrac;
          let minY = Infinity;

          for (let i = 0; i < N; i++) {
            const x  = i * STEP - STEP;
            const nx = x / wCW;

            let y = W0 * Math.sin(layer.freqs[0] * Math.PI * 2 * nx + ph[0])
              + W1 * Math.sin(layer.freqs[1] * Math.PI * 2 * nx + ph[1])
              + W2 * Math.sin(layer.freqs[2] * Math.PI * 2 * nx + ph[2]);
            y *= totalAmp;
            y += midAmp * Math.sin(layer.freqs[2] * Math.PI * 5.8 * nx + ph[2] * 1.7);

            pxs[i] = x;
            pys[i] = centerY + y;
            if (pys[i] < minY) minY = pys[i];
          }

          wCtx!.save();

          // KEEP THIS: Disable Canvas Filter on mobile
          if (layer.blur > 0 && !isMobileRef.current) {
            wCtx!.filter = `blur(${layer.blur}px)`;
          } else {
            wCtx!.filter = "none";
          }

          const fillGrad = wCtx!.createLinearGradient(0, minY - 10, 0, minY + wCH * 0.62);
          fillGrad.addColorStop(0,    `rgba(${cs(rgb)}, ${layer.alpha * op})`);
          fillGrad.addColorStop(0.28, `rgba(${cs(rgb)}, ${layer.alpha * op * 0.42})`);
          fillGrad.addColorStop(0.65, `rgba(${cs(rgb)}, ${layer.alpha * op * 0.10})`);
          fillGrad.addColorStop(1,    `rgba(${cs(rgb)}, 0)`);

          wCtx!.beginPath();
          traceCurve(wCtx!, pxs, pys, N);
          wCtx!.lineTo(pxs[N - 1], wCH + 10);
          wCtx!.lineTo(pxs[0] - STEP, wCH + 10);
          wCtx!.closePath();
          wCtx!.fillStyle = fillGrad;
          wCtx!.fill();

          if (layer.blur === 0) {
            // KEEP THIS: Disable expensive shadows on mobile
            if (!isMobileRef.current) {
              wCtx!.shadowBlur  = 22 + bassVal * 18;
              wCtx!.shadowColor = `rgba(${cs(rgb)}, 0.55)`;
            } else {
              wCtx!.shadowBlur = 0;
            }

            wCtx!.beginPath();
            traceCurve(wCtx!, pxs, pys, N);
            wCtx!.strokeStyle = `rgba(${cs(rgb)}, ${layer.alpha * op * 0.75})`;
            wCtx!.lineWidth   = 1.8;
            wCtx!.stroke();
          }

          wCtx!.restore();
        });
      }
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
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