import { useMemo } from "react";

import { KenBurns, LoadingScreen } from "@/components";
import { previewSlideRight } from "@/animation";
import { motion } from "framer-motion";
import styled from "styled-components";
import { useFetchPhotos } from "@/hooks/utils/usePhotos";

const Container = styled(motion.div)`
  z-index: 1;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
`;

const Fallback = styled.div`
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, #b1b5c0 0%, #686e7a 100%);
`;

const PhotosPreview = () => {
  const { data: photos, isLoading } = useFetchPhotos();

  const urls = useMemo(() => photos?.map((p) => p.url) ?? [], [photos]);

  return (
    <Container {...previewSlideRight}>
      {isLoading && !photos ? (
        <LoadingScreen backgroundColor="linear-gradient(180deg, #B1B5C0 0%, #686E7A 100%)" />
      ) : urls.length > 0 ? (
        <KenBurns urls={urls} />
      ) : (
        <Fallback />
      )}
    </Container>
  );
};

export default PhotosPreview;
