import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  normalizeAnswerCount,
  createTreeStateSerializer,
  getTreeDataStatus,
  readTreeMessage,
} from "./tree/bridge";
import { TREE_HTML } from "./tree/html";
import { TreeDataError } from "./tree/TreeDataError";
import type { TreeProps } from "./tree/types";

export { getTreeDataStatus } from "./tree/bridge";
export type { TreeDataStatus } from "./tree/bridge";
export { TREE_MAX_FRUITS } from "./tree/limits";

export type {
  TreeFruit,
  TreeNote,
  TreeProps,
  TreeWateringEvent,
} from "./tree/types";

const source = TREE_HTML.replace(
  "<script>",
  `<script>
  window.addEventListener('message', function (event) {
    if (event.source !== window.parent) event.stopImmediatePropagation();
  }, true);
  window.ReactNativeWebView = {
    postMessage: function (data) { window.parent.postMessage(data, '*'); }
  };
</script><script>`,
);

export function Tree(props: TreeProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  }, [props]);
  const session = useRef<string | null>(null);
  const revision = useRef(0);
  const allowTaps = useRef(false);
  const [unavailable, setUnavailable] = useState<
    "capacity" | "invalid-data" | null
  >(null);
  const serializer = useRef(createTreeStateSerializer());

  const requestReady = useCallback(() => {
    frame.current?.contentWindow?.postMessage(
      JSON.stringify({ type: "hello" }),
      "*",
    );
  }, []);

  const synchronize = useCallback(() => {
    if (!session.current) return;
    const nextRevision = revision.current + 1;
    const data = serializer.current(
      latest.current,
      session.current,
      nextRevision,
      !document.hidden,
      false,
    );
    if (data === null) {
      allowTaps.current = false;
      const status = getTreeDataStatus(latest.current);
      setUnavailable(
        status.status === "unavailable" ? status.reason : "invalid-data",
      );
      console.warn(
        "Tree snapshot exceeds supported transport limits; no fruits were truncated.",
      );
      return;
    }
    const target = frame.current?.contentWindow;
    try {
      if (!target) throw new Error("Tree transport unavailable");
      target.postMessage(data, "*");
    } catch {
      serializer.current.reset();
      allowTaps.current = false;
      setUnavailable("invalid-data");
      return;
    }
    revision.current = nextRevision;
    setUnavailable(null);
    allowTaps.current = true;
  }, []);

  useLayoutEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== "null"
      )
        return;
      const message = readTreeMessage(event.data);
      if (!message) return;
      if (message.type === "ready") {
        serializer.current.reset();
        session.current = message.session;
        synchronize();
        return;
      }
      if (
        !allowTaps.current ||
        message.session !== session.current ||
        message.revision !== revision.current ||
        message.index >= normalizeAnswerCount(latest.current.answers)
      )
        return;
      latest.current.onTapBlossom?.(message.index);
    };
    window.addEventListener("message", receive);
    document.addEventListener("visibilitychange", synchronize);
    requestReady();
    return () => {
      session.current = null;
      window.removeEventListener("message", receive);
      document.removeEventListener("visibilitychange", synchronize);
    };
  }, [synchronize, requestReady]);

  useLayoutEffect(synchronize, [
    props.timeOfDay,
    props.answers,
    props.mine,
    props.notes,
    props.lanterns,
    props.lightBundles,
    props.goldenLightBundles,
    props.lightEvent,
    props.fruits,
    props.wateringEvent,
    synchronize,
  ]);

  return (
    <View style={[styles.container, props.style]}>
      <iframe
        ref={frame}
        title="Shared StoryTime tree"
        aria-hidden={unavailable ? true : undefined}
        srcDoc={source}
        onLoad={requestReady}
        sandbox="allow-scripts"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          border: 0,
        }}
      />
      {unavailable && <TreeDataError reason={unavailable} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: "hidden", backgroundColor: "#0b1030" },
});
