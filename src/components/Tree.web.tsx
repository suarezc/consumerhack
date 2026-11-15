import { useCallback, useLayoutEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

import { normalizeTreeState, readTreeMessage } from "./tree/bridge";
import { TREE_HTML } from "./tree/html";
import type { TreeProps } from "./tree/types";

export type { TreeNote, TreeProps } from "./tree/types";

const source = TREE_HTML.replace(
  "<script>",
  `<script>
  const parentOrigin = new URL(document.referrer).origin;
  window.addEventListener('message', function (event) {
    if (event.source !== window.parent || event.origin !== parentOrigin) event.stopImmediatePropagation();
  }, true);
  window.ReactNativeWebView = {
    postMessage: function (data) { window.parent.postMessage(data, parentOrigin); }
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

  const requestReady = useCallback(() => {
    frame.current?.contentWindow?.postMessage(
      JSON.stringify({ type: "hello" }),
      "*",
    );
  }, []);

  const synchronize = useCallback(() => {
    if (!session.current) return;
    revision.current += 1;
    frame.current?.contentWindow?.postMessage(
      JSON.stringify({
        type: "state",
        session: session.current,
        revision: revision.current,
        ...normalizeTreeState(latest.current),
        active: !document.hidden,
        reduceMotion: false,
      }),
      "*",
    );
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
        referrerPolicy="origin"
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
