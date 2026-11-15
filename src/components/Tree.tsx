import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { AccessibilityInfo, AppState, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { normalizeTreeState, readTreeMessage } from "./tree/bridge";
import { TREE_HTML } from "./tree/html";
import type { TreeProps } from "./tree/types";

export type { TreeNote, TreeProps } from "./tree/types";

const source = { html: TREE_HTML };

export function Tree(props: TreeProps) {
  const webView = useRef<WebView<object>>(null);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  }, [props]);
  const session = useRef<string | null>(null);
  const revision = useRef(0);
  const active = useRef(AppState.currentState === "active");
  const reduceMotion = useRef(false);

  const synchronize = useCallback(() => {
    if (!session.current) return;
    revision.current += 1;
    webView.current?.postMessage(
      JSON.stringify({
        type: "state",
        session: session.current,
        revision: revision.current,
        ...normalizeTreeState(latest.current),
        active: active.current,
        reduceMotion: reduceMotion.current,
      }),
    );
  }, []);

  useEffect(synchronize, [
    props.timeOfDay,
    props.answers,
    props.mine,
    props.notes,
    props.lanterns,
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
