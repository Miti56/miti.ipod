import { motion } from "framer-motion";
import styled from "styled-components";
import { Unit } from "@/utils/constants";
import { PERSONAL_INFO } from "@/data/personal";

const Container = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: white;
  background: linear-gradient(180deg, #b1b5c0 0%, #686e7a 100%);
`;

const Avatar = styled.img`
  height: 5em;
  width: 5em;
  border-radius: 50%;
  margin: ${Unit.XS};
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.6);
`;

const Name = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 500;
`;

const Role = styled.h3`
  margin: 0;
  font-size: 13px;
  font-weight: 400;
  opacity: 0.85;
`;

const PortfolioPreview = () => {
  return (
    <Container>
      <Avatar alt={PERSONAL_INFO.name} src={PERSONAL_INFO.avatarUrl} />
      <Name>{PERSONAL_INFO.name}</Name>
      <Role>{PERSONAL_INFO.role}</Role>
    </Container>
  );
};

export default PortfolioPreview;
