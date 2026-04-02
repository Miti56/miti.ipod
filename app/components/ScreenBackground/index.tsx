"use client";
import { useScreenGlass } from "@/providers/ScreenGlassProvider";
import styled, { css } from "styled-components";
import { Screen } from "@/utils/constants";

// ─────────────────────────────────────────────────────────────────────────────
// ScreenBackground — the lowest layer inside ScreenContainer (z-index: -1).
//
// Desktop: always solid white — the EQ visualizer is visible around the iPod.
//
// Mobile only (≤ 576px):
//   • Not glass → solid white (normal iPod UI)
//   • Glass      → near-transparent frosted layer so the ambient blobs and
//                  waves glow through behind the UI content
//
// The parent ScreenContainer must have `isolation: isolate` so z-index: -1
// is contained within the screen area and does not fall behind the Shell.
// ─────────────────────────────────────────────────────────────────────────────

const Backdrop = styled.div<{ $glass: boolean }>`
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;

  /* Desktop — always opaque white */
  background: white;

  /* Mobile — slide to frosted glass when isGlass */
  ${Screen.SM.MediaQuery} {
    transition:
      background 1.1s ease,
      backdrop-filter 1.1s ease,
      -webkit-backdrop-filter 1.1s ease;

    ${({ $glass }) =>
      $glass
        ? css`
            background: rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(8px) saturate(160%);
            -webkit-backdrop-filter: blur(8px) saturate(160%);
          `
        : css`
            background: rgba(255, 255, 255, 1);
            backdrop-filter: blur(0px);
            -webkit-backdrop-filter: blur(0px);
          `}
  }
`;

const ScreenBackground = () => {
  const isGlass = useScreenGlass();
  return <Backdrop $glass={isGlass} />;
};

export default ScreenBackground;
