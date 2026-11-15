import { AccessoryWidgetBackground, Divider, HStack, Image, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  accessibilityElement, accessibilityLabel, aspectRatio, containerBackground, font, foregroundStyle,
  frame, lineLimit, minimumScaleFactor, opacity, padding, privacySensitive, resizable,
  widgetAccentedRenderingMode, widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import type { WidgetEnvironment } from "expo-widgets";

import type { WidgetProps } from "./model";

export function GivingWidget(props: WidgetProps, environment: WidgetEnvironment) {
  "widget";
  if (props.expiresAt !== null && Date.now() >= props.expiresAt) {
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
            modifiers={[resizable(), aspectRatio({ ratio: 1, contentMode: "fit" }), frame({ width: 42, height: 42 }), opacity(environment.isLuminanceReduced ? 0.7 : 1)]} />
        ) : (
          <Image systemName="arrow.clockwise" size={26} />
        )}
      </ZStack>
    );
  }
  const medium = environment.widgetFamily === "systemMedium";
  const fruit = props.fruitImage ? (
    <Image uiImage={props.fruitImage} modifiers={[
      resizable(), aspectRatio({ ratio: 1, contentMode: "fit" }), frame({ width: medium ? 78 : 84, height: medium ? 78 : 84 }),
      widgetAccentedRenderingMode("desaturated"),
    ]} />
  ) : <Image systemName="leaf" size={54} color={muted} modifiers={[frame({ height: 78 })]} />;
  const count = (
    <HStack alignment="firstTextBaseline" spacing={4}>
      <Text modifiers={[font({ family: displayFont, size: 25 }), foregroundStyle(ink)]}>{props.count === null ? "—" : String(props.count)}</Text>
      <Text modifiers={[font({ family: bodyFont, size: 10 }), foregroundStyle(muted)]}>{props.count === 1 ? "day of giving" : "days of giving"}</Text>
    </HStack>
  );
  if (medium) {
    return (
      <HStack spacing={12} modifiers={[
        padding({ all: 12 }), containerBackground(tile, "widget"), widgetURL(props.url), privacySensitive(),
      ]}>
        <VStack alignment="leading" spacing={2} modifiers={[frame({ width: 112 }), accessibilityLabel(label)]}>
          {fruit}{count}
          <Text modifiers={[font({ family: bodyFont, size: 9 }), foregroundStyle(muted), lineLimit(2)]}>{props.message}</Text>
        </VStack>
        <Divider />
        <VStack alignment="leading" spacing={3}>
          <HStack spacing={7}>
            {props.treeImage ? <Image uiImage={props.treeImage} modifiers={[resizable(), aspectRatio({ ratio: 1, contentMode: "fit" }), frame({ width: 42, height: 45 }), widgetAccentedRenderingMode("desaturated")]} /> : <Image systemName="tree" size={32} color={muted} />}
            <Text modifiers={[font({ family: displayFont, size: 12 }), foregroundStyle(ink), lineLimit(2)]}>Today&apos;s tree</Text>
          </HStack>
          <Text modifiers={[font({ family: displayFont, size: 21 }), foregroundStyle(ink), lineLimit(1), minimumScaleFactor(0.6)]}>{props.totalLabel}</Text>
          <Text modifiers={[font({ family: bodyFont, size: 10 }), foregroundStyle(muted), lineLimit(2)]}>S.A.C.K. · sandbox gross</Text>
          <Text modifiers={[font({ family: bodyFont, size: 10 }), foregroundStyle(muted)]}>{props.answersLabel}</Text>
          <Text modifiers={[font({ family: bodyFont, size: 8 }), foregroundStyle(muted), lineLimit(2)]}>{props.freshnessLabel}</Text>
        </VStack>
      </HStack>
    );
  }
  return (
    <VStack alignment="leading" spacing={2} modifiers={[
      padding({ all: 12 }), containerBackground(tile, "widget"), widgetURL(props.url), privacySensitive(),
      accessibilityElement(), accessibilityLabel(label),
    ]}>
      <HStack><Spacer />{fruit}<Spacer /></HStack>
      {count}
      <Text modifiers={[font({ family: bodyFont, size: 9 }), foregroundStyle(muted), lineLimit(2)]}>{props.message}</Text>
      <Text modifiers={[font({ family: bodyFont, size: 8 }), foregroundStyle(muted), lineLimit(1)]}>{props.freshnessLabel}</Text>
    </VStack>
  );
}
