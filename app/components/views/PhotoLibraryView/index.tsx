import { useMemo } from "react";

import SelectableList, {
  SelectableListOption,
} from "@/components/SelectableList";
import { useMenuHideView, useScrollHandler } from "@/hooks";
import { useFetchPhotos } from "@/hooks/utils/usePhotos";

const PhotoLibraryView = () => {
  useMenuHideView("photoLibrary");

  const { data: photos, isLoading } = useFetchPhotos();

  const options: SelectableListOption[] = useMemo(
    () =>
      (photos ?? []).map((photo, index) => ({
        type: "view",
        label: photo.name || `Photo ${index + 1}`,
        imageUrl: photo.url,
        viewId: "photoViewer" as const,
        headerTitle: photo.name || `Photo ${index + 1}`,
        props: { url: photo.url, name: photo.name || `Photo ${index + 1}` },
      })),
    [photos]
  );

  const [scrollIndex, handleItemClick] = useScrollHandler(
    "photoLibrary",
    options
  );

  return (
    <SelectableList
      loading={isLoading}
      options={options}
      activeIndex={scrollIndex}
      emptyMessage="No photos — add images to public/photos"
      onItemClick={handleItemClick}
    />
  );
};

export default PhotoLibraryView;
