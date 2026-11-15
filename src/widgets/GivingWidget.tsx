import { AccessoryWidgetBackground, Capsule, Circle, Divider, Ellipse, HStack, Image, Rectangle, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  accessibilityElement, accessibilityIdentifier, accessibilityLabel, containerBackground, font, foregroundStyle,
  frame, lineLimit, minimumScaleFactor, offset, opacity, padding, privacySensitive,
  rotationEffect, strokeBorder, widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import type { WidgetEnvironment } from "expo-widgets";

import type { WidgetProps } from "./model";

export function GivingWidget(props: WidgetProps, environment: WidgetEnvironment) {
  "widget";
  if (props.presentationVersion !== 2 || (props.expiresAt !== null && Date.now() >= props.expiresAt)) {
    props = {
      ...props, state: "unavailable", count: null, freshness: "expired",
      freshnessLabel: "Open StoryTime to refresh", message: "Your giving light, one day at a time.",
      totalLabel: "—", answersLabel: "Open today's tree",
    };
  }
  const circular = environment.widgetFamily === "accessoryCircular";
  const medium = environment.widgetFamily === "systemMedium";
  const reduced = !!environment.isLuminanceReduced;
  const monochrome = environment.widgetRenderingMode === "vibrant" || environment.widgetRenderingMode === "accented";
  const tile = "#1D2A33";
  const ink = monochrome ? { type: "hierarchical" as const, style: "primary" as const } : "#F2F6F4";
  const muted = monochrome ? { type: "hierarchical" as const, style: "secondary" as const } : "#A8B8B6";
  const lightStyle = monochrome ? { type: "hierarchical" as const, style: "primary" as const } : "#F7E7B0";
  const living = props.state === "current" || props.state === "at_risk";
  const filled = living && !reduced;
  const intensity = props.state === "at_risk" ? [0.8, 0.66, 0.52][props.fade] : 1;
  const scale = circular ? 0.6 : 1;
  const label = props.count === null ? "Open StoryTime to refresh your giving light" :
    `${props.count} days of giving. ${props.message}. ${props.freshnessLabel}.`;
  const bodyFont = "Inter-Regular";
  const displayFont = "BricolageGrotesque-14ptBold";
  const points = props.tier === 30 ? [[-35, -21], [-16, -34], [23, -29], [37, 2], [25, 27], [-29, 25]] :
    props.tier === 7 ? [[-30, -18], [23, -28], [33, 14], [-22, 28]] :
    props.tier === 3 ? [[-29, -17], [25, -20], [24, 25]] : [[-24, -14], [23, 18]];
  const sparks = filled ? (circular ? points.slice(0, 2) : points) : [];
  const light = props.state === "unavailable" ? <Image systemName="arrow.clockwise" size={circular ? 25 : 35} modifiers={[foregroundStyle(muted)]} /> : (
    <ZStack modifiers={[frame({ width: circular ? 58 : 96, height: circular ? 58 : medium ? 78 : 68 }), accessibilityLabel(label), accessibilityIdentifier("giving-firefly")]}>
      {!circular && filled ? (
        <Circle modifiers={[foregroundStyle(lightStyle), opacity(props.state === "at_risk" ? 0.045 : 0.09), frame({ width: 68, height: 68 }), accessibilityIdentifier("giving-halo")]} />
      ) : null}
      {!circular && filled ? (
        <ZStack>
          <Circle modifiers={[foregroundStyle("#00000000"), strokeBorder({ content: lightStyle, shape: "circle", style: { lineWidth: 1 } }), opacity(0.2 * intensity), frame({ width: 64, height: 64 })]} />
          {props.state === "at_risk" ? <Rectangle modifiers={[foregroundStyle(tile), frame({ width: 25, height: 48 }), offset({ x: 30 })]} /> : null}
        </ZStack>
      ) : null}
      {sparks.map(([x, y], index) => (
        <Circle key={index} modifiers={[
          foregroundStyle(lightStyle), opacity((index % 2 ? 0.38 : 0.6) * intensity), accessibilityIdentifier(`giving-spark-${index}`),
          frame({ width: (props.tier === 1 ? 2 : 3) * scale, height: (props.tier === 1 ? 2 : 3) * scale }),
          offset({ x: x * scale, y: y * scale }),
        ]} />
      ))}
      <Ellipse modifiers={[
        foregroundStyle(filled ? lightStyle : "#00000000"),
        strokeBorder({ content: lightStyle, shape: "ellipse", style: { lineWidth: scale } }),
        opacity((filled ? 0.35 : 0.65) * intensity), frame({ width: 22 * scale, height: 10 * scale }),
        rotationEffect(-28), offset({ x: -12 * scale, y: -5 * scale }),
      ]} />
      <Ellipse modifiers={[
        foregroundStyle(filled ? lightStyle : "#00000000"),
        strokeBorder({ content: lightStyle, shape: "ellipse", style: { lineWidth: scale } }),
        opacity((filled ? 0.35 : 0.65) * intensity), frame({ width: 22 * scale, height: 10 * scale }),
        rotationEffect(28), offset({ x: 12 * scale, y: -5 * scale }),
      ]} />
      <Capsule modifiers={[
        foregroundStyle(filled ? lightStyle : "#00000000"),
        strokeBorder({ content: lightStyle, shape: "capsule", style: { lineWidth: 1.3 * scale } }),
        opacity(intensity), frame({ width: 14 * scale, height: 26 * scale }),
        rotationEffect(-7), offset({ y: 6 * scale }),
      ]} />
      <Circle modifiers={[
        foregroundStyle(filled ? lightStyle : "#00000000"),
        strokeBorder({ content: lightStyle, shape: "circle", style: { lineWidth: scale } }),
        opacity(intensity), frame({ width: 6 * scale, height: 6 * scale }), offset({ y: -10 * scale }),
      ]} />
    </ZStack>
  );
  if (circular) {
    return (
      <ZStack modifiers={[
        containerBackground(tile, "widget"), widgetURL(props.url),
        privacySensitive(), accessibilityElement(), accessibilityLabel(label),
      ]}>
        <AccessoryWidgetBackground />
        {light}
      </ZStack>
    );
  }
  const count = (
    <HStack alignment="firstTextBaseline" spacing={4}>
      <Text modifiers={[font({ family: displayFont, size: 25 }), foregroundStyle(ink), lineLimit(1), minimumScaleFactor(0.6)]}>{props.count === null ? "—" : String(props.count)}</Text>
      <Text modifiers={[font({ family: bodyFont, size: 10 }), foregroundStyle(muted)]}>{props.count === 1 ? "day of giving" : "days of giving"}</Text>
    </HStack>
  );
  if (medium) {
    return (
      <HStack spacing={12} modifiers={[
        padding({ all: 12 }), containerBackground(tile, "widget"), widgetURL(props.url), privacySensitive(),
      ]}>
        <VStack alignment="leading" spacing={2} modifiers={[frame({ width: 112 }), accessibilityLabel(label)]}>
          {light}{count}
          <Text modifiers={[font({ family: bodyFont, size: 10 }), foregroundStyle(muted), lineLimit(2)]}>{props.message}</Text>
        </VStack>
        <Divider />
        <VStack alignment="leading" spacing={3}>
          <HStack spacing={7}>
            <ZStack modifiers={[frame({ width: 40, height: 43 }), accessibilityLabel("Today's shared tree")]}>
              <Capsule modifiers={[foregroundStyle(muted), frame({ width: 3, height: 28 }), offset({ y: 7 })]} />
              <Circle modifiers={[foregroundStyle(monochrome ? muted : "#88AA96"), frame({ width: 23, height: 23 }), offset({ x: -7, y: -3 })]} />
              <Circle modifiers={[foregroundStyle(monochrome ? muted : "#88AA96"), frame({ width: 24, height: 24 }), offset({ x: 7, y: -4 })]} />
              <Circle modifiers={[foregroundStyle(monochrome ? muted : "#A1BEAA"), frame({ width: 23, height: 23 }), offset({ y: -12 })]} />
            </ZStack>
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
      <HStack><Spacer />{light}<Spacer /></HStack>
      {count}
      <Text modifiers={[font({ family: bodyFont, size: 10 }), foregroundStyle(muted), lineLimit(2)]}>{props.message}</Text>
      <Text modifiers={[font({ family: bodyFont, size: 8 }), foregroundStyle(muted), lineLimit(1)]}>{props.freshnessLabel}</Text>
    </VStack>
  );
}
