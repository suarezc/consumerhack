import { type ReactNode } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native";

import { Tree, type TreeProps } from "@/components/Tree";
import { ProductScene, ProductSheet } from "@/design";

type SceneProps = {
  timeOfDay: number;
  title: string;
  meta: string;
  detail?: string;
  tree?: Partial<Pick<TreeProps, "answers" | "mine" | "notes" | "lanterns" | "onTapBlossom" | "fruits" | "wateringEvent">>;
  treeKey?: string;
  treeUnavailable?: boolean;
  children?: ReactNode;
  overlay?: (controlsHeight: number) => ReactNode;
  onOpenTree?: () => void;
  underQuestion?: ReactNode;
};

export function Scene({ timeOfDay, title, meta, detail, tree, treeKey, treeUnavailable, children, overlay, onOpenTree, underQuestion }: SceneProps) {
  return <>
    <StatusBar style={timeOfDay > 0.75 ? "light" : "dark"} />
    <ProductScene title={title} meta={meta} detail={detail} onOpenTree={onOpenTree} underQuestion={underQuestion} overlay={overlay} tree={
      treeUnavailable ? null : <Tree key={treeKey} timeOfDay={timeOfDay} answers={tree?.answers ?? 0} mine={tree?.mine ?? []}
      notes={tree?.notes ?? []} lanterns={tree?.lanterns ?? 0} onTapBlossom={tree?.onTapBlossom}
      fruits={tree?.fruits ?? []} wateringEvent={tree?.wateringEvent ?? null}
      style={StyleSheet.absoluteFill} />
    }>{children}</ProductScene>
  </>;
}

export function Panel({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <>
      <StatusBar style="light" />
      <ProductSheet title={title} onClose={onClose}>{children}</ProductSheet>
    </>;
}

export const sceneStyles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stack: { gap: 12 },
  message: { paddingVertical: 4 },
});
