import { createWidget } from "expo-widgets";

import { GivingWidget } from "./GivingWidget";
import { emptyWidget, type WidgetProps } from "./model";

const widget = (() => {
  try {
    return createWidget<WidgetProps>("StoryTimeGiving", GivingWidget, {
      ...emptyWidget("storytime://"),
      count: 0,
      expiresAt: 0,
      fruitImage: "",
      lockImage: "",
      lockOutlineImage: "",
      treeImage: "",
    });
  } catch {
    return null;
  }
})();

export default widget;
