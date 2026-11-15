import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { AccessibilityInfo, AppState, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

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
  const [unavailable, setUnavailable] = useState<
    "capacity" | "invalid-data" | null
  >(null);
  const serializer = useRef(createTreeStateSerializer());
  const active = useRef(AppState.currentState === "active");
  const reduceMotion = useRef(false);

  const synchronize = useCallback(() => {
    if (!session.current) return;
    const nextRevision = revision.current + 1;
    const data = serializer.current(
      latest.current,
      session.current,
      nextRevision,
      active.current,
      reduceMotion.current,
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
    const target = webView.current;
    try {
      if (!target) throw new Error("Tree transport unavailable");
      target.postMessage(data);
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
        serializer.current.reset();
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
      if (message.index >= normalizeAnswerCount(latest.current.answers)) return;
      latest.current.onTapBlossom?.(message.index);
    },
    [synchronize],
  );

  return (
    <View style={[styles.container, props.style]}>
      <WebView<object>
        ref={webView}
        source={source}
        accessibilityElementsHidden={Boolean(unavailable)}
        importantForAccessibility={unavailable ? "no-hide-descendants" : "auto"}
        style={styles.webView}
        originWhitelist={["*"]}
        onShouldStartLoadWithRequest={(request) =>
          request.url === "about:blank"
        }
        onLoadStart={() => {
          session.current = null;
          serializer.current.reset();
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
      {unavailable && <TreeDataError reason={unavailable} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: "hidden", backgroundColor: "#0b1030" },
  webView: { flex: 1, backgroundColor: "transparent" },
});
