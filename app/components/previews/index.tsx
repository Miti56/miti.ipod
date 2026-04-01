import GamesPreview from "./GamesPreview";
import MusicPreview from "./MusicPreview";
import NowPlayingPreview from "./NowPlayingPreview";
import PhotosPreview from "./PhotosPreview";
import PortfolioPreview from "./PortfolioPreview";
import ServicePreview from "./ServicePreview";
import SettingsPreview from "./SettingsPreview";
import ThemePreview from "./ThemePreview";

export enum SplitScreenPreview {
  Music = "music",
  Photos = "photos",
  Games = "games",
  Settings = "settings",
  NowPlaying = "nowPlaying",
  Portfolio = "portfolio",
  Service = "service",
  Theme = "theme",
}

/** Previews that use the slide-in animation (KenBurns-style). */
export const ANIMATED_PREVIEWS = new Set([
  SplitScreenPreview.Music,
  SplitScreenPreview.Photos,
]);

export const Previews = {
  [SplitScreenPreview.Music]: () => <MusicPreview />,
  [SplitScreenPreview.Photos]: () => <PhotosPreview />,
  [SplitScreenPreview.Games]: () => <GamesPreview />,
  [SplitScreenPreview.Settings]: () => <SettingsPreview />,
  [SplitScreenPreview.NowPlaying]: () => <NowPlayingPreview />,
  [SplitScreenPreview.Portfolio]: () => <PortfolioPreview />,
  [SplitScreenPreview.Service]: () => <ServicePreview />,
  [SplitScreenPreview.Theme]: () => <ThemePreview />,
};
