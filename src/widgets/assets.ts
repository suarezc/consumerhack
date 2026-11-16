import { Asset } from "expo-asset";
import { Directory, File } from "expo-file-system";

import type { WidgetEntry, WidgetProps } from "./model";

const images: Record<string, number> = {
  blossom: require("../../assets/widgets/blossom.png"),
  withered: require("../../assets/widgets/withered.png"),
  "healthy-1": require("../../assets/widgets/healthy-1.png"),
  "healthy-3": require("../../assets/widgets/healthy-3.png"),
  "healthy-7": require("../../assets/widgets/healthy-7.png"),
  "healthy-30": require("../../assets/widgets/healthy-30.png"),
  "thirsty-1-0": require("../../assets/widgets/thirsty-1-0.png"),
  "thirsty-1-1": require("../../assets/widgets/thirsty-1-1.png"),
  "thirsty-1-2": require("../../assets/widgets/thirsty-1-2.png"),
  "thirsty-3-0": require("../../assets/widgets/thirsty-3-0.png"),
  "thirsty-3-1": require("../../assets/widgets/thirsty-3-1.png"),
  "thirsty-3-2": require("../../assets/widgets/thirsty-3-2.png"),
  "thirsty-7-0": require("../../assets/widgets/thirsty-7-0.png"),
  "thirsty-7-1": require("../../assets/widgets/thirsty-7-1.png"),
  "thirsty-7-2": require("../../assets/widgets/thirsty-7-2.png"),
  "thirsty-30-0": require("../../assets/widgets/thirsty-30-0.png"),
  "thirsty-30-1": require("../../assets/widgets/thirsty-30-1.png"),
  "thirsty-30-2": require("../../assets/widgets/thirsty-30-2.png"),
  "lock-filled": require("../../assets/widgets/lock-filled.png"),
  "lock-outline": require("../../assets/widgets/lock-outline.png"),
  tree: require("../../assets/widgets/tree.png"),
};

export function imageKey(props: WidgetProps): string | null {
  if (props.state === "unavailable") return null;
  if (props.state === "healthy") return `healthy-${props.stage}`;
  if (props.state === "thirsty") return `thirsty-${props.stage}-${props.fade}`;
  return props.state;
}

export function createAssetPreparer(widgetsDirectory: string) {
  const directory = new Directory(widgetsDirectory, "storytime-art-v1");
  const pending = new Map<string, Promise<string>>();
  async function sharedImage(key: string): Promise<string> {
    const previous = pending.get(key);
    if (previous) return previous;
    const copy = (async () => {
      directory.create({ intermediates: true, idempotent: true });
      const destination = new File(directory, `${key}.png`);
      if (!destination.exists) {
        const asset = await Asset.fromModule(images[key]).downloadAsync();
        if (!asset.localUri) throw new Error("Widget artwork is unavailable");
        await new File(asset.localUri).copy(destination);
      }
      return destination.uri;
    })().catch((error: unknown) => { pending.delete(key); throw error; });
    pending.set(key, copy);
    return copy;
  }
  return async (entries: WidgetEntry[]): Promise<WidgetEntry[]> => {
    return Promise.all(entries.map(async (entry) => {
      const key = imageKey(entry.props);
      if (!key) return entry;
      const [fruitImage, lockImage, lockOutlineImage, treeImage] = await Promise.all([
        sharedImage(key), sharedImage(entry.props.state === "healthy" ? "lock-filled" : "lock-outline"),
        sharedImage("lock-outline"), sharedImage("tree"),
      ]);
      return { ...entry, props: { ...entry.props, fruitImage, lockImage, lockOutlineImage, treeImage } };
    }));
  };
}
