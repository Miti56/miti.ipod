import { useMenuHideView } from "@/hooks";
import styled from "styled-components";

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
  url: string;
  name: string;
}

const PhotoViewerView = ({ url, name }: Props) => {
  useMenuHideView("photoViewer");

  return (
    <Container>
      <Photo src={url} alt={name} />
    </Container>
  );
};

export default PhotoViewerView;
