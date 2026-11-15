import { useEffect, useMemo, useRef, useState } from "react";
import {
  TIMELINE_DURATION_MS,
  timelineSnapshot,
  type SampleAction,
} from "./timeline";

export function useStoryTimeline() {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [actions, setActions] = useState<SampleAction[]>([]);
  const started = useRef(0);
  const sequence = useRef(0);
  const run = useRef(0);
  useEffect(() => {
    if (!playing) return;
    if (!started.current) started.current = performance.now();
    let raf = 0,
      last = 0;
    const tick = (now: number) => {
      const value = Math.min(1, (now - started.current) / TIMELINE_DURATION_MS);
      if (now - last >= 100 || value === 1) {
        setProgress(value);
        last = now;
      }
      if (value === 1) setPlaying(false);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  const snapshot = useMemo(
    () => timelineSnapshot(progress, actions),
    [progress, actions],
  );
  return {
    ...snapshot,
    progress,
    playing,
    seconds: progress * 15,
    play() {
      started.current = performance.now() - progress * TIMELINE_DURATION_MS;
      setPlaying(true);
    },
    pause() {
      setPlaying(false);
    },
    scrub(value: number) {
      setPlaying(false);
      setProgress(Math.min(1, Math.max(0, value)));
    },
    restart() {
      run.current += 1;
      sequence.current = 0;
      setActions([]);
      setProgress(0);
      started.current = performance.now();
      setPlaying(true);
    },
    addResponse() {
      setPlaying(false);
      const id = `sample-run-${run.current}-response-${++sequence.current}`;
      setActions((v) => [
        ...v,
        {
          id,
          at: progress,
          type: "response",
        },
      ]);
    },
    addBundles(bundles: 2 | 5 | 10) {
      if (!snapshot.fruits.length) return;
      setPlaying(false);
      const id = `sample-run-${run.current}-bundle-${++sequence.current}`;
      setActions((v) => [
        ...v,
        {
          id,
          at: progress,
          type: "bundles",
          bundles,
        },
      ]);
    },
  };
}
