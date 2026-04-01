import GamesPreview from "./GamesPreview";
import MusicPreview from "./MusicPreview";
import NowPlayingPreview from "./NowPlayingPreview";
import PortfolioPreview from "./PortfolioPreview";
import ServicePreview from "./ServicePreview";
import SettingsPreview from "./SettingsPreview";
import ThemePreview from "./ThemePreview";

export enum SplitScreenPreview {
  Music = "music",
  Games = "games",
  Settings = "settings",
  NowPlaying = "nowPlaying",
  Portfolio = "portfolio",
  Service = "service",
  Theme = "theme",
}

export const Previews = {
  [SplitScreenPreview.Music]: () => <MusicPreview />,
  [SplitScreenPreview.Games]: () => <GamesPreview />,
  [SplitScreenPreview.Settings]: () => <SettingsPreview />,
  [SplitScreenPreview.NowPlaying]: () => <NowPlayingPreview />,
  [SplitScreenPreview.Portfolio]: () => <PortfolioPreview />,
  [SplitScreenPreview.Service]: () => <ServicePreview />,
  [SplitScreenPreview.Theme]: () => <ThemePreview />,
};
