import { useCallback, useLayoutEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

import {
  normalizeTreeState,
  readTreeMessage,
  serializeTreeState,
} from "./tree/bridge";
import { TREE_HTML } from "./tree/html";
import type { TreeProps } from "./tree/types";

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

  const requestReady = useCallback(() => {
    frame.current?.contentWindow?.postMessage(
      JSON.stringify({ type: "hello" }),
      "*",
    );
  }, []);

  const synchronize = useCallback(() => {
    if (!session.current) return;
    const nextRevision = revision.current + 1;
    const data = serializeTreeState(
      latest.current,
      session.current,
      nextRevision,
      !document.hidden,
      false,
    );
    if (data === null) {
      allowTaps.current = false;
      console.warn(
        "Tree snapshot exceeds supported transport limits; no fruits were truncated.",
      );
      return;
    }
    revision.current = nextRevision;
    allowTaps.current = true;
    frame.current?.contentWindow?.postMessage(data, "*");
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
        session.current = message.session;
        synchronize();
        return;
      }
      if (
        !allowTaps.current ||
        message.session !== session.current ||
        message.revision !== revision.current ||
        message.index >= normalizeTreeState(latest.current).answers
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
    props.fruits,
    props.wateringEvent,
    synchronize,
  ]);

  return (
    <View style={[styles.container, props.style]}>
      <iframe
        ref={frame}
        title="Shared StoryTime tree"
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: "hidden", backgroundColor: "#0b1030" },
});
