import { SelectableList, SelectableListOption } from "@/components";
import { useMenuHideView, useScrollHandler } from "@/hooks";
import styled from "styled-components";
import { Unit } from "@/utils/constants";

const Container = styled.div`
  display: flex;
  flex-direction: column;
`;

const TitleContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${Unit.MD} ${Unit.MD} 0;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 900;
`;

const Description = styled.h3`
  margin: 0 0 ${Unit.MD};
  font-size: 14px;
  font-weight: normal;
  text-align: center;
`;

const ListContainer = styled.div`
  flex: 1;
`;

const PortfolioView = () => {
  useMenuHideView("portfolio");

  const options: SelectableListOption[] = [
    {
      type: "link",
      label: "GitHub",
      url: "https://github.com/yourusername",
    },
    {
      type: "link",
      label: "Portfolio",
      url: "https://yourportfolio.com",
    },
    {
      type: "link",
      label: "LinkedIn",
      url: "https://linkedin.com/in/yourusername",
    },
  ];

  const [scrollIndex] = useScrollHandler("portfolio", options);

  return (
    <Container>
      <ListContainer>
        <TitleContainer>
          <Title>Portfolio</Title>
        </TitleContainer>
        <Description>
          Built with{" "}
          <span aria-label="heart" role="img">
            ❤️
          </span>{" "}
          using React &amp; Next.js
        </Description>
        <SelectableList options={options} activeIndex={scrollIndex} />
      </ListContainer>
    </Container>
  );
};

export default PortfolioView;
