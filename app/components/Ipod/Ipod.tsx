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

const Ipod = () => {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalStyles />
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
