"use client";
import { createContext, useContext } from "react";
import { useAudioPlayer } from "@/hooks";

// ─────────────────────────────────────────────────────────────────────────────
// ScreenGlassContext — single source of truth for the "see-through screen" state.
//
// isGlass is true when:
//   • music is actively playing (not paused, not stopped), AND
//   • the top view is the NowPlaying screen
//
// When isGlass flips to false (pause, stop, or navigate away) every consumer
// transitions back to a solid white background.
// ─────────────────────────────────────────────────────────────────────────────

const ScreenGlassContext = createContext(false);

export const useScreenGlass = () => useContext(ScreenGlassContext);

export const ScreenGlassProvider = ({ children }: { children: React.ReactNode }) => {
  const { playbackInfo } = useAudioPlayer();

  // Glass is active whenever music is playing (not paused, not stopped).
  // Pausing or stopping brings the white background back.
  const isGlass = playbackInfo.isPlaying && !playbackInfo.isPaused;

  return (
    <ScreenGlassContext.Provider value={isGlass}>
      {children}
    </ScreenGlassContext.Provider>
  );
};
