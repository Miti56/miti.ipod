import SelectableList, {
  SelectableListOption,
} from "@/components/SelectableList";
import { useMenuHideView, useScrollHandler } from "@/hooks";
import { SOCIAL_LINKS } from "@/data/personal";

const PortfolioView = () => {
  useMenuHideView("portfolio");

  const options: SelectableListOption[] = SOCIAL_LINKS.map((link) => ({
    type: "link",
    label: link.label,
    url: link.url,
  }));

  const [scrollIndex, handleItemClick] = useScrollHandler("portfolio", options);

  return (
    <SelectableList
      options={options}
      activeIndex={scrollIndex}
      onItemClick={handleItemClick}
    />
  );
};

export default PortfolioView;
