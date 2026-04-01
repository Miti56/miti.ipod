import { SelectableList, SelectableListOption } from "@/components";
import { useMenuHideView, useScrollHandler } from "@/hooks";
import { useMusicStats } from "@/hooks/utils/useDataFetcher";
import styled from "styled-components";
import { Unit } from "@/utils/constants";
import { APP_URL } from "@/utils/constants/api";
import { PERSONAL_INFO, SOCIAL_LINKS } from "@/data/personal";

const Container = styled.div`
  display: flex;
  flex-direction: column;
`;

const Image = styled.img`
  height: ${Unit.XL};
  width: auto;
  margin: ${Unit.XS};
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

const StorageInfo = styled.div`
  text-align: center;
  font-size: 12px;
  color: rgb(100, 100, 100);
  padding: 0 ${Unit.MD} ${Unit.SM};
`;

const AboutView = () => {
  useMenuHideView("about");
  const { songCount, totalSizeBytes, capacityGB } = useMusicStats();
  const usedGB = (totalSizeBytes / (1024 ** 3)).toFixed(1);

  const options: SelectableListOption[] = SOCIAL_LINKS.map((link) => ({
    type: "link",
    label: link.label,
    url: link.url,
  }));

  const [scrollIndex, handleItemClick] = useScrollHandler("about", options);

  return (
    <Container>
      <ListContainer>
        <TitleContainer>
          <Image alt="iPod" src={`${APP_URL}/ipod_logo.svg`} />
          <Title>{PERSONAL_INFO.deviceTitle}</Title>
        </TitleContainer>
        <Description>{PERSONAL_INFO.tagline}</Description>
        <StorageInfo>
          <div>{songCount} songs</div>
          <div>{usedGB} GB used of {capacityGB} GB</div>
        </StorageInfo>
        <SelectableList options={options} activeIndex={scrollIndex} onItemClick={handleItemClick} />
      </ListContainer>
    </Container>
  );
};

export default AboutView;
