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
import { GlobalStyles } from "@/components/Ipod/GlobalStyles";

const Ipod = () => {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalStyles />
      <SettingsProvider>
        <ViewContextProvider>
          <AudioPlayerProvider>
            <SettingsContext.Consumer>
              {([{ deviceTheme }]) => (
                <Shell $deviceTheme={deviceTheme}>
                  <Sticker $deviceTheme={deviceTheme} />
                  <Sticker2 $deviceTheme={deviceTheme} />
                  <Sticker3 $deviceTheme={deviceTheme} />
                  <ScreenContainer>
                    <ViewManager />
                    <ScreenOverlay />
                  </ScreenContainer>
                  <ClickWheelContainer>
                    <ClickWheel />
                  </ClickWheelContainer>
                </Shell>
              )}
            </SettingsContext.Consumer>
          </AudioPlayerProvider>
        </ViewContextProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
};

export default memo(Ipod);
