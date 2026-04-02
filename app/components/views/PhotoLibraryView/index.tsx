import { useMemo } from "react";

import SelectableList, {
  SelectableListOption,
} from "@/components/SelectableList";
import { useMenuHideView, useScrollHandler } from "@/hooks";
import { useFetchPhotos } from "@/hooks/utils/usePhotos";

const PhotoLibraryView = () => {
  useMenuHideView("photoLibrary");

  const { data: photos, isLoading } = useFetchPhotos();

  const photoList = useMemo(
    () =>
      (photos ?? []).map((photo, index) => ({
        url: photo.url,
        name: photo.name || `Photo ${index + 1}`,
      })),
    [photos]
  );

  const options: SelectableListOption[] = useMemo(
    () =>
      photoList.map((photo, index) => ({
        type: "view",
        label: photo.name,
        imageUrl: photo.url,
        viewId: "photoViewer" as const,
        headerTitle: photo.name,
        props: { photos: photoList, initialIndex: index },
      })),
    [photoList]
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
