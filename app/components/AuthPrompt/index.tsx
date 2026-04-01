import styled from "styled-components";
import { Unit } from "@/utils/constants";

const RootContainer = styled.div`
  display: grid;
  place-content: center;
  text-align: center;
  height: 100%;
  background: white;
`;

const Title = styled.h3`
  margin: ${Unit.XS} 0 ${Unit.XXS};
  font-weight: bold;
  font-size: 18px;
`;

const Text = styled.p`
  font-size: 14px;
  margin: 0;
  max-width: 120px;
  color: rgb(100, 100, 100);
`;

const strings = {
  defaultMessage: "No content available",
};

interface Props {
  message?: string;
}

const AuthPrompt = ({ message }: Props) => {
  return (
    <RootContainer>
      <Title>Library</Title>
      <Text>{message ?? strings.defaultMessage}</Text>
    </RootContainer>
  );
};

export default AuthPrompt;
