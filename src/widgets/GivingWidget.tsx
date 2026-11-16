import { AccessoryWidgetBackground, Divider, HStack, Image, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  accessibilityElement, accessibilityLabel, aspectRatio, containerBackground, font, foregroundStyle,
  frame, lineLimit, minimumScaleFactor, padding, privacySensitive, resizable,
  widgetAccentedRenderingMode, widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import type { WidgetEnvironment } from "expo-widgets";

import type { WidgetProps } from "./model";

export function GivingWidget(props: WidgetProps, environment: WidgetEnvironment) {
  "widget";
  if (props.presentationVersion !== 2 || (props.expiresAt !== null && Date.now() >= props.expiresAt)) {
    props = {
      ...props, state: "unavailable", count: null, freshness: "expired",
      freshnessLabel: "Open StoryTime to refresh", message: "A new ritual day has begun.",
      totalLabel: "—", answersLabel: "Open today's tree",
      fruitImage: null, lockImage: null, lockOutlineImage: null, treeImage: null,
    };
  }
  const dark = environment.colorScheme === "dark";
  const ink = dark ? "#E9F0EA" : "#17231C";
  const muted = dark ? "#9BAA9F" : "#5A6B60";
  const tile = props.state === "thirsty" ? (dark ? "#262519" : "#F6F3EA") :
    props.state === "withered" ? (dark ? "#232221" : "#EFEDEA") : (dark ? "#1B2620" : "#FFFFFF");
  const label = props.count === null ? "Open StoryTime to refresh your giving ritual" :
    `${props.count} days of giving. ${props.message} ${props.freshnessLabel}.`;
  const bodyFont = "Inter-Regular";
  const displayFont = "BricolageGrotesque-14ptBold";
  if (environment.widgetFamily === "accessoryCircular") {
    return (
      <ZStack modifiers={[
        containerBackground("#1D2A33", "widget"), widgetURL(props.url),
        privacySensitive(), accessibilityElement(), accessibilityLabel(label),
      ]}>
        <AccessoryWidgetBackground />
        {props.lockImage ? (
          <Image uiImage={environment.isLuminanceReduced ? props.lockOutlineImage ?? props.lockImage : props.lockImage}
            modifiers={[resizable(), aspectRatio({ ratio: 1, contentMode: "fit" }), frame({ width: 44, height: 44 })]} />
        ) : <Image systemName="arrow.clockwise" size={26} />}
      </ZStack>
    );
  }
  const medium = environment.widgetFamily === "systemMedium";
  const fruit = props.fruitImage ? (
    <Image uiImage={props.fruitImage} modifiers={[
      resizable(), aspectRatio({ ratio: 1, contentMode: "fit" }),
      frame({ maxWidth: medium ? 96 : 120, maxHeight: medium ? 96 : 108 }),
      widgetAccentedRenderingMode("desaturated"),
    ]} />
  ) : <Image systemName="leaf" size={54} color={muted} modifiers={[frame({ height: 90 })]} />;
  const count = (
    <HStack alignment="firstTextBaseline" spacing={5}>
      <Text modifiers={[font({ family: displayFont, size: 26 }), foregroundStyle(ink), lineLimit(1), minimumScaleFactor(0.6)]}>{props.count === null ? "—" : String(props.count)}</Text>
      <Text modifiers={[font({ family: bodyFont, size: medium ? 10 : 12 }), foregroundStyle(muted)]}>{medium ? "days of giving" : props.count === 1 ? "day" : "days"}</Text>
    </HStack>
  );
  if (medium) {
    return (
      <HStack spacing={14} modifiers={[
        padding({ all: 14 }), containerBackground(tile, "widget"), widgetURL(props.url), privacySensitive(),
      ]}>
        <VStack alignment="leading" spacing={2} modifiers={[frame({ width: 108 }), accessibilityLabel(label)]}>
          {fruit}{count}
        </VStack>
        <Divider />
        <HStack spacing={10}>
          {props.treeImage ? <Image uiImage={props.treeImage} modifiers={[
            resizable(), aspectRatio({ ratio: 74 / 86, contentMode: "fit" }),
            frame({ width: 54, height: 78 }), accessibilityLabel("Today's tree"),
            widgetAccentedRenderingMode("desaturated"),
          ]} /> : <Image systemName="tree" size={38} color={muted} />}
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={[font({ family: bodyFont, weight: "semibold", size: 20 }), foregroundStyle(ink), lineLimit(1), minimumScaleFactor(0.6)]}>{props.totalLabel}</Text>
            <Text modifiers={[font({ family: bodyFont, size: 11 }), foregroundStyle(muted), lineLimit(2)]}>raised today for S.A.C.K.</Text>
            <Text modifiers={[font({ family: bodyFont, size: 11 }), foregroundStyle(muted)]}>{props.answersLabel}</Text>
            <Text modifiers={[font({ family: bodyFont, size: 8 }), foregroundStyle(muted), lineLimit(2)]}>Sandbox gross · {props.freshnessLabel}</Text>
          </VStack>
        </HStack>
      </HStack>
    );
  }
  return (
    <VStack alignment="leading" spacing={3} modifiers={[
      padding({ horizontal: 14, vertical: 12 }), containerBackground(tile, "widget"), widgetURL(props.url), privacySensitive(),
      accessibilityElement(), accessibilityLabel(label),
    ]}>
      <HStack><Spacer />{fruit}<Spacer /></HStack>
      {count}
      <Text modifiers={[font({ family: bodyFont, size: 11.5 }), foregroundStyle(muted), lineLimit(2)]}>
        {props.freshness === "aging" || props.state === "unavailable" ? props.freshnessLabel : props.message}
      </Text>
    </VStack>
  );
}
