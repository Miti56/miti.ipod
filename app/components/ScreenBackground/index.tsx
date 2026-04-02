"use client";
import { useEffect, useRef } from "react";
import { useAudioPlayer } from "@/hooks";
import { useAlbumColors, DEFAULT_PALETTE, RGB } from "@/hooks/audio/useAlbumColors";
import { useScreenGlass } from "@/providers/ScreenGlassProvider";
import styled from "styled-components";
import { Screen } from "@/utils/constants";

// ─────────────────────────────────────────────────────────────────────────────
// ScreenBackground — lives at z-index 0 inside ScreenContainer (isolation:isolate).
//
// Three layers:
//   BlobCanvas  — ambient blob animation, fills the screen area.
//   WaveCanvas  — audio-reactive ocean waves, same dimensions.
//   WhiteOverlay— opaque white div sitting above both canvases.
// ─────────────────────────────────────────────────────────────────────────────

const BLOBS = [
  { cx:0.30, cy:0.42, rx:[0.30,0.10], ry:[0.22,0.12], sx:[0.07,0.13], sy:[0.09,0.11], radius:0.90, alpha:0.92, pi:0 },
  { cx:0.72, cy:0.60, rx:[0.24,0.09], ry:[0.28,0.11], sx:[0.08,0.11], sy:[0.07,0.14], radius:0.82, alpha:0.86, pi:1 },
  { cx:0.50, cy:0.22, rx:[0.32,0.11], ry:[0.20,0.09], sx:[0.06,0.10], sy:[0.11,0.08], radius:0.74, alpha:0.80, pi:2 },
  { cx:0.18, cy:0.76, rx:[0.20,0.09], ry:[0.32,0.10], sx:[0.10,0.09], sy:[0.06,0.12], radius:0.66, alpha:0.74, pi:3 },
  { cx:0.84, cy:0.30, rx:[0.22,0.10], ry:[0.26,0.08], sx:[0.09,0.12], sy:[0.08,0.10], radius:0.60, alpha:0.68, pi:4 },
] as const;

const LAYERS = [
  { blur: 14, amp: 0.300, speeds: [0.11, 0.07, 0.04], freqs: [1.4, 2.3, 0.8],  yFrac: 0.535, alpha: 0.18, pi: 0 },
  { blur: 6,  amp: 0.240, speeds: [0.18, 0.11, 0.06], freqs: [1.9, 3.1, 1.2],  yFrac: 0.515, alpha: 0.28, pi: 1 },
  { blur: 2,  amp: 0.190, speeds: [0.26, 0.16, 0.09], freqs: [2.3, 3.8, 1.6],  yFrac: 0.500, alpha: 0.44, pi: 2 },
  { blur: 0,  amp: 0.145, speeds: [0.34, 0.21, 0.13], freqs: [2.8, 4.6, 2.1],  yFrac: 0.485, alpha: 0.62, pi: 3 },
  { blur: 0,  amp: 0.100, speeds: [0.44, 0.28, 0.17], freqs: [3.4, 5.5, 2.6],  yFrac: 0.465, alpha: 0.78, pi: 4 },
];
const W0 = 0.55, W1 = 0.30, W2 = 0.15;
const MAX_N = 256;

// ── Helpers ────────────────────────────────────────────────────────────────────
interface Spr { v: number; x: number }
function spr(s: Spr, target: number, k: number, damp: number): number {
  s.v += (target - s.x) * k;
  s.v *= damp;
  s.x += s.v;
  return s.x;
}

const CL = 0.022;
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

// ── Styled components ──────────────────────────────────────────────────────────
const Wrapper = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
`;

const BlobCanvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  filter: blur(40px) saturate(1.35);

  ${Screen.SM.MediaQuery} {
    filter: blur(20px) saturate(1.2);
  }
`;

const WaveCanvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
`;

const WhiteOverlay = styled.div<{ $glass: boolean }>`
  position: absolute;
  inset: 0;
  background: white;
  opacity: 1;

  ${Screen.SM.MediaQuery} {
    transition: opacity 1.1s ease;
    opacity: ${({ $glass }) => ($glass ? 0 : 1)};
  }
`;

// ── Component ──────────────────────────────────────────────────────────────────
const ScreenBackground = () => {
  const isGlass    = useScreenGlass();
  const { nowPlayingItem, analyserNode, playbackInfo } = useAudioPlayer();
  const palette    = useAlbumColors(nowPlayingItem?.artwork?.url);

  const blobCanvasRef = useRef<HTMLCanvasElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef        = useRef(0);

  const blobPhasesRef = useRef<number[][]>(
    BLOBS.map(() => Array.from({ length: 4 }, () => Math.random() * Math.PI * 2))
  );
  const wavePhasesRef = useRef<number[][]>(
    LAYERS.map(() => [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28])
  );

  const curBlobs = useRef<RGB[]>(DEFAULT_PALETTE.blobs.slice(0, 5).map(c => [...c] as RGB));
  const curBg    = useRef<RGB>([...DEFAULT_PALETTE.bgBase] as RGB);
  const tgtBlobs = useRef(curBlobs.current);
  const tgtBg    = useRef(curBg.current);
  const curWaves = useRef<RGB[]>(DEFAULT_PALETTE.waves.map(c => [...c] as RGB));
  const tgtWaves = useRef(curWaves.current);

  const bassS      = useRef<Spr>({ v: 0, x: 0 });
  const midS       = useRef<Spr>({ v: 0, x: 0 });
  const bassFloor  = useRef(0);
  const midFloor   = useRef(0);
  const freqRef    = useRef(new Uint8Array(1024));
  const opacRef    = useRef(0.0);
  const beatRef    = useRef(0);
  const prevBassR  = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const activeRef   = useRef(false);

  useEffect(() => { analyserRef.current = analyserNode; }, [analyserNode]);
  useEffect(() => {
    activeRef.current = playbackInfo.isPlaying && !playbackInfo.isPaused;
  }, [playbackInfo.isPlaying, playbackInfo.isPaused]);

  useEffect(() => {
    tgtBlobs.current = palette.blobs.slice(0, 5).map(c => [...c] as RGB);
    tgtBg.current    = [...palette.bgBase] as RGB;
    tgtWaves.current = palette.waves.map(c => [...c] as RGB);
  }, [palette]);

  useEffect(() => {
    const bCanvas = blobCanvasRef.current;
    const wCanvas = waveCanvasRef.current;
    if (!bCanvas || !wCanvas) return;
    const bCtx = bCanvas.getContext("2d");
    const wCtx = wCanvas.getContext("2d");
    if (!bCtx || !wCtx) return;

    let isMobile = window.innerWidth <= 576;

    // DOWN-SCALE BLOBS: Renders 80% fewer pixels to GPU
    const DOWNSCALE = 0.2;

    const resize = () => {
      isMobile = window.innerWidth <= 576;
      const container = bCanvas.parentElement?.parentElement;
      if (!container) return;

      const W = container.clientWidth;
      const H = container.clientHeight;

      // Blobs run at 20% resolution (CSS stretches it)
      bCanvas.width  = W * DOWNSCALE;
      bCanvas.height = H * DOWNSCALE;
      bCanvas.style.width = `${W}px`;
      bCanvas.style.height = `${H}px`;

      // Waves stay crisp at 100% resolution
      wCanvas.width  = W;
      wCanvas.height = H;
    };

    resize();
    const ro = new ResizeObserver(resize);
    const container = bCanvas.parentElement?.parentElement;
    if (container) ro.observe(container);

    let alive   = true;
    let lastNow = performance.now();
    const pxs   = new Float32Array(MAX_N);
    const pys   = new Float32Array(MAX_N);

    function frame(now: number) {
      if (!alive) return;
      rafRef.current = requestAnimationFrame(frame);

      // FIXED TIME CLAMP: Allow dt up to 0.1s to catch up on dropped frames
      const dt = Math.min((now - lastNow) / 1000, 0.1);
      lastNow = now;

      // Extract the logical display width/height
      const lW = wCanvas!.width;
      const lH = wCanvas!.height;
      if (lW === 0 || lH === 0) return;

      const isActive = activeRef.current;
      const blobTarget = isActive ? tgtBlobs.current : DEFAULT_PALETTE.blobs.slice(0, 5) as RGB[];
      const bgTarget   = isActive ? tgtBg.current    : DEFAULT_PALETTE.bgBase as RGB;
      const waveTarget = isActive ? tgtWaves.current : DEFAULT_PALETTE.waves as RGB[];

      const cb = curBlobs.current;
      for (let i = 0; i < 5; i++) cb[i] = lerpRgb(cb[i], blobTarget[i]);
      curBg.current = lerpRgb(curBg.current, bgTarget);
      const cw = curWaves.current;
      for (let i = 0; i < 5; i++) cw[i] = lerpRgb(cw[i], waveTarget[i]);

      // ── Blob canvas (Downscaled) ────────────────────────────────────────────
      bCtx!.save();
      bCtx!.scale(DOWNSCALE, DOWNSCALE);
      bCtx!.fillStyle = `rgb(${cs(curBg.current)})`;
      bCtx!.fillRect(0, 0, lW, lH);

      const blobCount = isMobile ? 3 : BLOBS.length;
      BLOBS.slice(0, blobCount).forEach((blob, bi) => {
        const ph = blobPhasesRef.current[bi];
        ph[0] += dt * blob.sx[0];
        ph[1] += dt * blob.sx[1];
        ph[2] += dt * blob.sy[0];
        ph[3] += dt * blob.sy[1];

        const bx = blob.cx * lW + blob.rx[0] * lW * Math.sin(ph[0]) + blob.rx[1] * lW * Math.sin(ph[1]);
        const by = blob.cy * lH + blob.ry[0] * lH * Math.sin(ph[2]) + blob.ry[1] * lH * Math.sin(ph[3]);
        const r  = blob.radius * Math.min(lW, lH);
        const rgb = cb[blob.pi];

        const grad = bCtx!.createRadialGradient(bx, by, 0, bx, by, r);
        grad.addColorStop(0,    `rgba(${cs(rgb)}, ${blob.alpha.toFixed(3)})`);
        grad.addColorStop(0.45, `rgba(${cs(rgb)}, ${(blob.alpha * 0.38).toFixed(3)})`);
        grad.addColorStop(1,    `rgba(${cs(rgb)}, 0)`);

        bCtx!.fillStyle = grad;
        bCtx!.beginPath();
        bCtx!.arc(bx, by, r, 0, Math.PI * 2);
        bCtx!.fill();
      });
      bCtx!.restore();

      // ── Wave canvas (Full res, optimized drawing) ───────────────────────────
      const targetOp = isActive ? 1.0 : 0.22;
      opacRef.current += (targetOp - opacRef.current) * 0.022;
      const op = opacRef.current;

      wCtx!.clearRect(0, 0, lW, lH);

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

        bassFloor.current += (rawB - bassFloor.current) * (rawB > bassFloor.current ? 0.005 : 0.02);
        midFloor.current  += (rawM - midFloor.current)  * (rawM > midFloor.current  ? 0.005 : 0.02);

        const bassRaw = Math.min(1, Math.max(0, rawB - bassFloor.current) * 3.5);
        const midRaw  = Math.min(1, Math.max(0, rawM - midFloor.current) * 3.0);

        const bassVal = spr(bassS.current, bassRaw, 0.15, 0.65);
        const midVal  = spr(midS.current,  midRaw,  0.15, 0.70);

        if (bassRaw - prevBassR.current > 0.15) beatRef.current = 1.0;
        beatRef.current  *= 0.90;
        prevBassR.current = bassRaw;

        const breathe   = 1 + 0.030 * Math.sin(now * 0.00065);
        const beatBoost = 1 + beatRef.current * 0.42;

        // FIXED: Restore all layers on mobile so the bass visualization remains
        LAYERS.forEach((layer, li) => {
          const ph  = wavePhasesRef.current[li];
          const rgb = cw[layer.pi];

          const STEP = layer.blur > 8 ? 10 : layer.blur > 0 ? 5 : 3;
          const N    = Math.min(Math.ceil(lW / STEP) + 2, MAX_N);

          const IDLE_FLOOR = 0.35;
          const totalAmp = layer.amp * lH * (IDLE_FLOOR + (1 - IDLE_FLOOR) * bassVal) * breathe * beatBoost;
          const midAmp   = layer.amp * lH * midVal * 0.30;
          const centerY  = lH * layer.yFrac;
          let minY = Infinity;

          for (let i = 0; i < N; i++) {
            const x  = i * STEP - STEP;
            const nx = x / lW;

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

          if (layer.blur > 0) {
            wCtx!.filter = isMobile ? "none" : `blur(${layer.blur}px)`;
          } else {
            wCtx!.filter = "none";
          }

          const fillGrad = wCtx!.createLinearGradient(0, minY - 10, 0, minY + lH * 0.62);
          fillGrad.addColorStop(0,    `rgba(${cs(rgb)}, ${layer.alpha * op})`);
          fillGrad.addColorStop(0.28, `rgba(${cs(rgb)}, ${layer.alpha * op * 0.42})`);
          fillGrad.addColorStop(0.65, `rgba(${cs(rgb)}, ${layer.alpha * op * 0.10})`);
          fillGrad.addColorStop(1,    `rgba(${cs(rgb)}, 0)`);

          wCtx!.beginPath();
          traceCurve(wCtx!, pxs, pys, N);
          wCtx!.lineTo(pxs[N - 1], lH + 10);
          wCtx!.lineTo(pxs[0] - STEP, lH + 10);
          wCtx!.closePath();
          wCtx!.fillStyle = fillGrad;
          wCtx!.fill();

          if (layer.blur === 0) {
            // FIXED: Do not calculate or draw shadows on mobile
            if (!isMobile) {
              wCtx!.shadowBlur  = 24 + bassVal * 22;
              wCtx!.shadowColor = `rgba(${cs(rgb)}, 0.65)`;
            } else {
              wCtx!.shadowBlur = 0;
              wCtx!.shadowColor = "transparent";
            }

            wCtx!.beginPath();
            traceCurve(wCtx!, pxs, pys, N);
            wCtx!.strokeStyle = `rgba(${cs(rgb)}, ${layer.alpha * op * 0.85})`;
            wCtx!.lineWidth   = 2.0;
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
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Wrapper>
      <BlobCanvas ref={blobCanvasRef} />
      <WaveCanvas ref={waveCanvasRef} />
      <WhiteOverlay $glass={isGlass} />
    </Wrapper>
  );
};

export default ScreenBackground;