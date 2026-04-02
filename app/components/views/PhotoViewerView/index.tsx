import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";

import { useEventListener, useMenuHideView, useViewContext } from "@/hooks";
import { IpodEvent } from "@/utils/events";

const Container = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  background: black;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Photo = styled.img`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
`;

interface Props {
  photos: { url: string; name: string }[];
  initialIndex: number;
}

const PhotoViewerView = ({ photos, initialIndex }: Props) => {
  useMenuHideView("photoViewer");

  const { setHeaderTitle } = useViewContext();
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    setHeaderTitle(photos[index]?.name);
  }, [index, photos, setHeaderTitle]);

  const handleForward = useCallback(() => {
    setIndex((prev) => (prev < photos.length - 1 ? prev + 1 : prev));
  }, [photos.length]);

  const handleBackward = useCallback(() => {
    setIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  useEventListener<IpodEvent>("forwardscroll", handleForward);
  useEventListener<IpodEvent>("backwardscroll", handleBackward);

  const current = photos[index];
  if (!current) return null;

  return (
    <Container>
      <Photo src={current.url} alt={current.name} />
    </Container>
  );
};

export default PhotoViewerView;
