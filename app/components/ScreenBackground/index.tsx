"use client";
import { useEffect, useRef } from "react";
import { useAudioPlayer } from "@/hooks";
import { useAlbumColors, DEFAULT_PALETTE, RGB } from "@/hooks/audio/useAlbumColors";
import { useScreenGlass } from "@/providers/ScreenGlassProvider";
import styled from "styled-components";

// ─────────────────────────────────────────────────────────────────────────────
// ScreenBackground — z-index: -1 layer inside ScreenContainer.
//
// Desktop / not glass:  solid white div (canvas invisible).
// Mobile + glass:       the white div fades out and a canvas running its own
//                       ambient blob animation fades in — so the screen itself
//                       glows with the album-art colours instead of trying to
//                       show through the (opaque) iPod shell behind it.
//
// The blob animation is a simplified version of EqVisualizer — same Lissajous
// motion and CSS-blur lava-lamp technique, but scaled to the screen area.
// ─────────────────────────────────────────────────────────────────────────────

// Blob config (fewer / smaller than the full-page version)
const BLOBS = [
  { cx:0.30, cy:0.40, rx:[0.28,0.10], ry:[0.22,0.12], sx:[0.07,0.13], sy:[0.09,0.11], radius:0.70, alpha:0.80, pi:0 },
  { cx:0.72, cy:0.62, rx:[0.24,0.09], ry:[0.28,0.11], sx:[0.08,0.11], sy:[0.07,0.14], radius:0.62, alpha:0.74, pi:1 },
  { cx:0.50, cy:0.22, rx:[0.32,0.11], ry:[0.20,0.09], sx:[0.06,0.10], sy:[0.11,0.08], radius:0.56, alpha:0.68, pi:2 },
  { cx:0.18, cy:0.76, rx:[0.20,0.09], ry:[0.32,0.10], sx:[0.10,0.09], sy:[0.06,0.12], radius:0.50, alpha:0.64, pi:3 },
  { cx:0.82, cy:0.30, rx:[0.22,0.10], ry:[0.26,0.08], sx:[0.09,0.12], sy:[0.08,0.10], radius:0.44, alpha:0.60, pi:4 },
] as const;

const CL = 0.022;
function lerpRgb(a: RGB, b: RGB): RGB {
  return [
    a[0] + (b[0] - a[0]) * CL,
    a[1] + (b[1] - a[1]) * CL,
    a[2] + (b[2] - a[2]) * CL,
  ];
}
const cs = (c: RGB) => `${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])}`;

// White layer — always present, fades out when glass activates
const White = styled.div<{ $glass: boolean }>`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: white;
  transition: opacity 1.1s ease;
  opacity: ${({ $glass }) => ($glass ? 0 : 1)};
`;

// Canvas — underneath, fades in when glass activates
const Canvas = styled.canvas<{ $glass: boolean }>`
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  transition: opacity 1.1s ease;
  opacity: ${({ $glass }) => ($glass ? 1 : 0)};
  filter: blur(50px) saturate(1.2);
`;

const ScreenBackground = () => {
  const isGlass = useScreenGlass();
  const { nowPlayingItem } = useAudioPlayer();
  const artworkUrl = nowPlayingItem?.artwork?.url || undefined;
  const palette = useAlbumColors(artworkUrl);

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef(0);

  const phasesRef = useRef<number[][]>(
    BLOBS.map(() => Array.from({ length: 4 }, () => Math.random() * Math.PI * 2))
  );

  const curBlobs = useRef<RGB[]>(DEFAULT_PALETTE.blobs.slice(0, 5).map(c => [...c] as RGB));
  const curBg    = useRef<RGB>([...DEFAULT_PALETTE.bgBase] as RGB);
  const tgtBlobs = useRef(curBlobs.current);
  const tgtBg    = useRef(curBg.current);

  useEffect(() => {
    tgtBlobs.current = palette.blobs.slice(0, 5).map(c => [...c] as RGB);
    tgtBg.current    = [...palette.bgBase] as RGB;
  }, [palette]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width  = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    let alive   = true;
    let lastNow = performance.now();

    function frame(now: number) {
      if (!alive) return;
      rafRef.current = requestAnimationFrame(frame);

      const dt = Math.min((now - lastNow) / 1000, 0.05);
      lastNow = now;

      const CW = canvas!.width;
      const CH = canvas!.height;

      const cb = curBlobs.current;
      const tb = tgtBlobs.current;
      for (let i = 0; i < 5; i++) cb[i] = lerpRgb(cb[i], tb[i]);
      curBg.current = lerpRgb(curBg.current, tgtBg.current);

      ctx!.fillStyle = `rgb(${cs(curBg.current)})`;
      ctx!.fillRect(0, 0, CW, CH);

      BLOBS.forEach((blob, bi) => {
        const ph = phasesRef.current[bi];
        ph[0] += dt * blob.sx[0];
        ph[1] += dt * blob.sx[1];
        ph[2] += dt * blob.sy[0];
        ph[3] += dt * blob.sy[1];

        const bx = blob.cx * CW + blob.rx[0] * CW * Math.sin(ph[0]) + blob.rx[1] * CW * Math.sin(ph[1]);
        const by = blob.cy * CH + blob.ry[0] * CH * Math.sin(ph[2]) + blob.ry[1] * CH * Math.sin(ph[3]);
        const r   = blob.radius * Math.min(CW, CH);
        const rgb = cb[blob.pi];

        const grad = ctx!.createRadialGradient(bx, by, 0, bx, by, r);
        grad.addColorStop(0,    `rgba(${cs(rgb)}, ${blob.alpha.toFixed(3)})`);
        grad.addColorStop(0.45, `rgba(${cs(rgb)}, ${(blob.alpha * 0.38).toFixed(3)})`);
        grad.addColorStop(1,    `rgba(${cs(rgb)}, 0)`);

        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(bx, by, r, 0, Math.PI * 2);
        ctx!.fill();
      });
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
    <>
      <Canvas ref={canvasRef} $glass={isGlass} />
      <White $glass={isGlass} />
    </>
  );
};

export default ScreenBackground;
