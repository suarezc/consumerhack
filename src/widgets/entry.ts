import { createWidget } from "expo-widgets";

import { GivingWidget } from "./GivingWidget";
import { emptyWidget } from "./model";

export default createWidget("StoryTimeGiving", GivingWidget, emptyWidget("storytime://"));
