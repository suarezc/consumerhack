import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { AccessibilityInfo, AppState, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

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

const source = { html: TREE_HTML };

export function Tree(props: TreeProps) {
  const webView = useRef<WebView<object>>(null);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  }, [props]);
  const session = useRef<string | null>(null);
  const revision = useRef(0);
  const allowTaps = useRef(false);
  const active = useRef(AppState.currentState === "active");
  const reduceMotion = useRef(false);

  const synchronize = useCallback(() => {
    if (!session.current) return;
    const nextRevision = revision.current + 1;
    const data = serializeTreeState(
      latest.current,
      session.current,
      nextRevision,
      active.current,
      reduceMotion.current,
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
    webView.current?.postMessage(data);
  }, []);

  useEffect(synchronize, [
    props.timeOfDay,
    props.answers,
    props.mine,
    props.notes,
    props.lanterns,
    props.fruits,
    props.wateringEvent,
    synchronize,
  ]);

  useEffect(() => {
    let mounted = true;
    let motionChanged = false;
    const appSubscription = AppState.addEventListener("change", (state) => {
      active.current = state === "active";
      synchronize();
    });
    const motionSubscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        motionChanged = true;
        reduceMotion.current = value;
        synchronize();
      },
    );
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (!mounted || motionChanged) return;
        reduceMotion.current = value;
        synchronize();
      })
      .catch(() => {});
    return () => {
      mounted = false;
      session.current = null;
      appSubscription.remove();
      motionSubscription.remove();
    };
  }, [synchronize]);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const message = readTreeMessage(event.nativeEvent.data);
      if (!message) return;
      if (message.type === "ready") {
        session.current = message.session;
        synchronize();
        return;
      }
      if (
        !allowTaps.current ||
        message.session !== session.current ||
        message.revision !== revision.current
      )
        return;
      if (message.index >= normalizeTreeState(latest.current).answers) return;
      latest.current.onTapBlossom?.(message.index);
    },
    [synchronize],
  );

  return (
    <View style={[styles.container, props.style]}>
      <WebView<object>
        ref={webView}
        source={source}
        style={styles.webView}
        originWhitelist={["*"]}
        onShouldStartLoadWithRequest={(request) =>
          request.url === "about:blank"
        }
        onLoadStart={() => {
          session.current = null;
          allowTaps.current = false;
        }}
        onMessage={onMessage}
        onContentProcessDidTerminate={() => webView.current?.reload()}
        onRenderProcessGone={() => webView.current?.reload()}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        javaScriptCanOpenWindowsAutomatically={false}
        setSupportMultipleWindows={false}
        allowFileAccess={false}
        mixedContentMode="never"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: "hidden", backgroundColor: "#0b1030" },
  webView: { flex: 1, backgroundColor: "transparent" },
});
