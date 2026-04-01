import { useMemo } from "react";

import { getConditionalOption } from "@/components/SelectableList";
import SelectableList, {
  SelectableListOption,
} from "@/components/SelectableList";
import { SplitScreenPreview } from "@/components/previews";
import {
  useAudioPlayer,
  useMenuHideView,
  useScrollHandler,
} from "@/hooks";

const MusicView = () => {
  const { nowPlayingItem } = useAudioPlayer();
  useMenuHideView("music");

  const options: SelectableListOption[] = useMemo(
    () => [
      {
        type: "view",
        label: "Cover Flow",
        viewId: "coverFlow",
        preview: SplitScreenPreview.Music,
      },
      {
        type: "view",
        label: "Playlists",
        viewId: "playlists",
        preview: SplitScreenPreview.Music,
      },
      {
        type: "view",
        label: "Artists",
        viewId: "artists",
        preview: SplitScreenPreview.Music,
      },
      {
        type: "view",
        label: "Albums",
        viewId: "albums",
        preview: SplitScreenPreview.Music,
      },
      {
        type: "view",
        label: "Search",
        viewId: "search",
        preview: SplitScreenPreview.Music,
      },
      ...getConditionalOption(!!nowPlayingItem, {
        type: "view",
        label: "Now Playing",
        viewId: "nowPlaying",
        preview: SplitScreenPreview.NowPlaying,
      }),
    ],
    [nowPlayingItem]
  );

  const [scrollIndex, handleItemClick] = useScrollHandler("music", options);

  return <SelectableList options={options} activeIndex={scrollIndex} onItemClick={handleItemClick} />;
};

export default MusicView;
