"use client";
import { memo } from "react";
import {
  AudioPlayerProvider,
  SettingsContext,
  SettingsProvider,
} from "@/hooks";
import { ClickWheel, ViewManager } from "@/components";
import {
  ScreenContainer,
  ScreenOverlay,
  ClickWheelContainer,
  Shell,
  Sticker,
  Sticker2,
  Sticker3,
} from "@/components/Ipod/Styled";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ViewContextProvider from "@/providers/ViewContextProvider";
import { ScreenGlassProvider } from "@/providers/ScreenGlassProvider";
import { GlobalStyles } from "@/components/Ipod/GlobalStyles";
import EqVisualizer from "@/components/EqVisualizer";
import ScreenBackground from "@/components/ScreenBackground";

/**
 * SVG filter definitions used by ScreenContainer via CSS filter: url(#ipod-lcd).
 *
 * ipod-lcd — chromatic aberration that mimics the optical imperfection of old
 * LCD panels. The red channel shifts 0.8 px right and the blue channel shifts
 * 0.8 px left, producing the characteristic colour fringe on sharp edges
 * (text, icons, UI borders). The effect is intentionally subtle — just enough
 * to feel like you're looking through real display glass.
 */
const ScreenFilters = () => (
  <svg
    width="0"
    height="0"
    aria-hidden="true"
    style={{ position: "absolute", overflow: "hidden", pointerEvents: "none" }}
  >
    <defs>
      <filter
        id="ipod-lcd"
        x="-1%"
        y="-1%"
        width="102%"
        height="102%"
        colorInterpolationFilters="sRGB"
      >
        {/* Split source into isolated R, G, B channels */}
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
          result="r"
        />
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
          result="g"
        />
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
          result="b"
        />
        {/* Shift red right, blue left — classic LCD lateral chromatic aberration */}
        <feOffset in="r" dx="0.8" dy="0" result="r_shifted" />
        <feOffset in="b" dx="-0.8" dy="0" result="b_shifted" />
        {/* Recombine channels additively (screen = light mixing) */}
        <feBlend in="r_shifted" in2="g" mode="screen" result="rg" />
        <feBlend in="rg" in2="b_shifted" mode="screen" />
      </filter>
    </defs>
  </svg>
);

const Ipod = () => {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalStyles />
      <ScreenFilters />
      <SettingsProvider>
        <ViewContextProvider>
          <AudioPlayerProvider>
            <EqVisualizer />
            <ScreenGlassProvider>
              <SettingsContext.Consumer>
                {([{ deviceTheme }]) => (
                  <Shell $deviceTheme={deviceTheme}>
                    <Sticker $deviceTheme={deviceTheme} />
                    <Sticker2 $deviceTheme={deviceTheme} />
                    <Sticker3 $deviceTheme={deviceTheme} />
                    <ScreenContainer>
                      <ScreenBackground />
                      <ViewManager />
                      <ScreenOverlay />
                    </ScreenContainer>
                    <ClickWheelContainer>
                      <ClickWheel />
                    </ClickWheelContainer>
                  </Shell>
                )}
              </SettingsContext.Consumer>
            </ScreenGlassProvider>
          </AudioPlayerProvider>
        </ViewContextProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
};

export default memo(Ipod);
