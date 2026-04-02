"use client";
import { useEffect, useRef } from "react";
import { useAudioPlayer } from "@/hooks";
import { useAlbumColors, DEFAULT_PALETTE, RGB } from "@/hooks/audio/useAlbumColors";

// ─────────────────────────────────────────────────────────────────────────────
// Layer definitions — drawn back to front.
// Each layer is a slow horizontal waveform made of 3 overlapping sine components.
//
// blur      px of depth-blur (back=soft, front=sharp)
// amp       base amplitude as fraction of canvas height
// speeds    phase drift speed (radians/s) for each sine component
// freqs     spatial frequency (cycles across screen) for each component
// yFrac     vertical centre of wave as fraction of canvas height
// alpha     fill opacity at the wave surface
// pi        index into the album-art palette (0=darkest, 4=palest)
// ─────────────────────────────────────────────────────────────────────────────
const LAYERS = [
  { blur: 20, amp: 0.240, speeds: [0.11, 0.07, 0.04], freqs: [1.4, 2.3, 0.8],  yFrac: 0.535, alpha: 0.13, pi: 0 },
  { blur: 9,  amp: 0.185, speeds: [0.18, 0.11, 0.06], freqs: [1.9, 3.1, 1.2],  yFrac: 0.515, alpha: 0.21, pi: 1 },
  { blur: 2,  amp: 0.145, speeds: [0.26, 0.16, 0.09], freqs: [2.3, 3.8, 1.6],  yFrac: 0.500, alpha: 0.34, pi: 2 },
  { blur: 0,  amp: 0.105, speeds: [0.34, 0.21, 0.13], freqs: [2.8, 4.6, 2.1],  yFrac: 0.485, alpha: 0.50, pi: 3 },
  { blur: 0,  amp: 0.075, speeds: [0.44, 0.28, 0.17], freqs: [3.4, 5.5, 2.6],  yFrac: 0.465, alpha: 0.65, pi: 4 },
];

// Relative amplitude weight of each sine component (must sum to 1)
const W0 = 0.55, W1 = 0.30, W2 = 0.15;

// ── Spring helpers ────────────────────────────────────────────────────────────
interface Spr { v: number; x: number }
function spr(s: Spr, target: number, k: number, damp: number): number {
  s.v += (target - s.x) * k;
  s.v *= damp;
  s.x += s.v;
  return s.x;
}

// ── Colour lerp ───────────────────────────────────────────────────────────────
const CL = 0.038;
function lerpRgb(a: RGB, b: RGB): RGB {
  return [a[0] + (b[0] - a[0]) * CL, a[1] + (b[1] - a[1]) * CL, a[2] + (b[2] - a[2]) * CL];
}
const cs = (c: RGB) => `${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])}`;

// ── Smooth bezier through sampled points ──────────────────────────────────────
function traceCurve(ctx: CanvasRenderingContext2D, xs: Float32Array, ys: Float32Array, n: number) {
  ctx.moveTo(xs[0], ys[0]);
  for (let i = 1; i < n - 1; i++) {
    const mx = (xs[i] + xs[i + 1]) * 0.5;
    const my = (ys[i] + ys[i + 1]) * 0.5;
    ctx.quadraticCurveTo(xs[i], ys[i], mx, my);
  }
  ctx.lineTo(xs[n - 1], ys[n - 1]);
}

// ── Component ─────────────────────────────────────────────────────────────────
const EqVisualizer = () => {
  const { analyserNode, playbackInfo, nowPlayingItem } = useAudioPlayer();
  const artworkUrl = nowPlayingItem?.artwork?.url || undefined;
  const palette    = useAlbumColors(artworkUrl);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef(0);
  const freqRef   = useRef(new Uint8Array(1024));
  const opacRef   = useRef(0.0);
  const activeRef = useRef(false);

  // Per-layer phase accumulator: [layerIdx][componentIdx]
  const phasesRef = useRef<number[][]>(
    LAYERS.map(() => [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28])
  );

  // Audio springs
  const bassS = useRef<Spr>({ v: 0, x: 0 });
  const midS  = useRef<Spr>({ v: 0, x: 0 });

  // Beat detection
  const beatRef   = useRef(0);
  const prevBassR = useRef(0);

  // Colour state — lerped frame-by-frame so colour changes never restart the RAF loop
  const curCol = useRef({
    waves:  DEFAULT_PALETTE.waves.map(c => [...c] as RGB),
    bgMid:  [...DEFAULT_PALETTE.bgMid]  as RGB,
    bgEdge: [...DEFAULT_PALETTE.bgEdge] as RGB,
  });
  const tgtCol = useRef(curCol.current);

  // Sync active flag
  useEffect(() => {
    activeRef.current = playbackInfo.isPlaying && !playbackInfo.isPaused;
  }, [playbackInfo.isPlaying, playbackInfo.isPaused]);

  // Push extracted palette into target ref
  useEffect(() => {
    tgtCol.current = {
      waves:  palette.waves.map(c => [...c] as RGB),
      bgMid:  [...palette.bgMid]  as RGB,
      bgEdge: [...palette.bgEdge] as RGB,
    };
  }, [palette]);

  // ── Main loop ───────────────────────────────────────────────────────────────
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

    let alive   = true;
    let lastNow = performance.now();

    // Pre-allocate typed arrays (re-used each frame, no GC pressure)
    const MAX_N  = 512;
    const pxs    = new Float32Array(MAX_N);
    const pys    = new Float32Array(MAX_N);

    function frame(now: number) {
      if (!alive) return;
      rafRef.current = requestAnimationFrame(frame);

      const dt = Math.min((now - lastNow) / 1000, 0.05);
      lastNow  = now;

      const CW = canvas!.width;
      const CH = canvas!.height;
      const isActive = activeRef.current;

      // ── Opacity: idle at 0.18, full at 1.0 when playing ─────────────────
      const targetOp = isActive ? 1.0 : 0.18;
      opacRef.current += (targetOp - opacRef.current) * 0.022;
      const op = opacRef.current;
      if (op < 0.01) { ctx!.clearRect(0, 0, CW, CH); return; }

      // ── Advance phases ────────────────────────────────────────────────────
      LAYERS.forEach((layer, li) => {
        phasesRef.current[li][0] += dt * layer.speeds[0];
        phasesRef.current[li][1] += dt * layer.speeds[1];
        phasesRef.current[li][2] += dt * layer.speeds[2];
      });

      // ── Frequency data ────────────────────────────────────────────────────
      if (analyserNode && isActive) {
        analyserNode.getByteFrequencyData(freqRef.current);
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
      // Scale raw reads up — typical music sits at 0.2–0.4 raw,
      // so we map that range to 0.5–1.0 to drive full amplitude.
      const bassRaw = Math.min(1, avg(1, 8)   * 2.8);
      const midRaw  = Math.min(1, avg(8, 60)  * 2.2);

      // Spring-smooth each band (high freq removed — raw noise caused jitter)
      const bassVal = spr(bassS.current, bassRaw, 0.10, 0.70);
      const midVal  = spr(midS.current,  midRaw,  0.10, 0.75);

      // Beat transient detection
      if (bassRaw - prevBassR.current > 0.12) beatRef.current = 1.0;
      beatRef.current  *= 0.90;
      prevBassR.current = bassRaw;

      // Global breathing oscillation (very slow, subtle)
      const breathe   = 1 + 0.030 * Math.sin(now * 0.00065);
      const beatBoost = 1 + beatRef.current * 0.38;

      // Lerp colours toward target
      const cc  = curCol.current;
      const tc  = tgtCol.current;
      for (let i = 0; i < 5; i++) cc.waves[i] = lerpRgb(cc.waves[i], tc.waves[i]);
      cc.bgMid  = lerpRgb(cc.bgMid,  tc.bgMid);
      cc.bgEdge = lerpRgb(cc.bgEdge, tc.bgEdge);

      // ── Clear ─────────────────────────────────────────────────────────────
      ctx!.clearRect(0, 0, CW, CH);

      // ── Deep background ───────────────────────────────────────────────────
      // Slightly off-centre radial so it feels painterly, not perfectly symmetric
      const bgGrad = ctx!.createRadialGradient(
        CW * 0.48, CH * 0.50, 0,
        CW * 0.48, CH * 0.50, Math.max(CW, CH) * 0.78
      );
      bgGrad.addColorStop(0,   `rgba(${cs(cc.bgMid)},  ${op * 0.80})`);
      bgGrad.addColorStop(0.6, `rgba(${cs(cc.bgEdge)}, ${op * 0.92})`);
      bgGrad.addColorStop(1,   `rgba(0,0,0,              ${op})`);
      ctx!.fillStyle = bgGrad;
      ctx!.fillRect(0, 0, CW, CH);

      // ── Wave layers ───────────────────────────────────────────────────────
      LAYERS.forEach((layer, li) => {
        const ph  = phasesRef.current[li];
        const rgb = cc.waves[layer.pi];

        // Sample density: back-layers can afford coarser steps (they're blurred anyway)
        const STEP = layer.blur > 8 ? 14 : layer.blur > 0 ? 7 : 4;
        const N    = Math.min(Math.ceil(CW / STEP) + 2, MAX_N);

        // Amplitude: always has a minimum floor so the ocean never stops moving
        const IDLE_FLOOR = 0.30;
        const totalAmp = layer.amp * CH * (IDLE_FLOOR + (1 - IDLE_FLOOR) * bassVal) * breathe * beatBoost;
        const midAmp   = layer.amp * CH * midVal * 0.28;

        const centerY = CH * layer.yFrac;
        let minY = Infinity;

        for (let i = 0; i < N; i++) {
          const x  = i * STEP - STEP;
          const nx = x / CW;

          // Three sine components per layer
          let y = W0 * Math.sin(layer.freqs[0] * Math.PI * 2 * nx + ph[0])
                + W1 * Math.sin(layer.freqs[1] * Math.PI * 2 * nx + ph[1])
                + W2 * Math.sin(layer.freqs[2] * Math.PI * 2 * nx + ph[2]);
          y *= totalAmp;

          // Mid ripple — higher-frequency sine modulated by vocal/mid energy
          y += midAmp * Math.sin(layer.freqs[2] * Math.PI * 5.8 * nx + ph[2] * 1.7);


          pxs[i] = x;
          pys[i] = centerY + y;
          if (pys[i] < minY) minY = pys[i];
        }

        ctx!.save();

        // Back layers: depth blur to simulate atmosphere / water depth
        if (layer.blur > 0) ctx!.filter = `blur(${layer.blur}px)`;

        // ── Filled wave body (surface → bottom of canvas) ──────────────────
        // This creates the "ocean" look — coloured water mass below each wave
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

        // ── Wave surface glow + bright edge line (front layers only) ────────
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

      // ── Subtle top reflection (glass / liquid surface highlight) ──────────
      const glossH = CH * 0.05;
      const gloss  = ctx!.createLinearGradient(0, 0, 0, glossH);
      gloss.addColorStop(0, `rgba(255,255,255,${0.055 * op})`);
      gloss.addColorStop(1, "rgba(255,255,255,0)");
      ctx!.fillStyle = gloss;
      ctx!.fillRect(0, 0, CW, glossH);

      // ── Edge vignette (darkens corners, keeps iPod as focal point) ────────
      const vig = ctx!.createRadialGradient(CW * 0.5, CH * 0.5, CH * 0.20, CW * 0.5, CH * 0.5, CH * 0.85);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, `rgba(0,0,0,${0.50 * op})`);
      ctx!.fillStyle = vig;
      ctx!.fillRect(0, 0, CW, CH);
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
