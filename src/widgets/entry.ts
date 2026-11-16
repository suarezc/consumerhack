import { createWidget } from "expo-widgets";

import { GivingWidget } from "./GivingWidget";
import { emptyWidget } from "./model";

const widget = (() => {
  try {
    return createWidget("StoryTimeGiving", GivingWidget, {
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
