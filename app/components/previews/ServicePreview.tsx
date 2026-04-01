import { motion } from "framer-motion";
import styled from "styled-components";
import { Unit } from "@/utils/constants";
import { APP_URL } from "@/utils/constants/api";

const Container = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: white;
  background: linear-gradient(180deg, #b1b5c0 0%, #686e7a 100%);
`;

const Image = styled.img`
  height: 6em;
  width: 6em;
  margin: ${Unit.XS};
`;

const Text = styled.h3`
  margin: 4px 0 0;
  font-size: 16px;
  font-weight: 600;
`;

const Subtext = styled(Text)`
  font-size: 14px;
  font-weight: 400;
`;

const ServicePreview = () => {
  return (
    <Container>
      <Image alt="Library" src={`${APP_URL}/ipod_logo.svg`} />
      <Text>Local Library</Text>
      <Subtext>Your music collection</Subtext>
    </Container>
  );
};

export default ServicePreview;
