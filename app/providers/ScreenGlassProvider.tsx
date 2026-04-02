"use client";
import { createContext, useContext } from "react";
import { useAudioPlayer, useViewContext } from "@/hooks";

// isGlass = music is actively playing AND the current view is NowPlaying or CoverFlow.
// All other views/states keep normal white backgrounds.

const ScreenGlassContext = createContext(false);

export const useScreenGlass = () => useContext(ScreenGlassContext);

export const ScreenGlassProvider = ({ children }: { children: React.ReactNode }) => {
  const { playbackInfo } = useAudioPlayer();
  const { viewStack } = useViewContext();

  const isPlaying = playbackInfo.isPlaying && !playbackInfo.isPaused;

  const screenViews = viewStack.filter((v) => v.type === "screen");
  const topScreen   = screenViews[screenViews.length - 1];

  const isOnNowPlaying = topScreen?.id === "nowPlaying";
  const isOnCoverFlow  = screenViews.some((v) => v.id === "coverFlow");

  const isGlass = isPlaying && (isOnNowPlaying || isOnCoverFlow);

  return (
    <ScreenGlassContext.Provider value={isGlass}>
      {children}
    </ScreenGlassContext.Provider>
  );
};
