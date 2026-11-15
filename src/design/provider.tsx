import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useStoryTimeFonts } from './fonts';
import { themeAt } from './theme';

const StoryTimeContext = createContext({
  theme: themeAt(0),
  fontsLoaded: false,
  fontError: null as Error | null,
  reducedMotion: true,
});

export type StoryTimeProviderProps = PropsWithChildren<{
  timeOfDay: number;
  reducedMotion?: boolean;
}>;

export function StoryTimeProvider({ timeOfDay, reducedMotion, children }: StoryTimeProviderProps) {
  const { loaded, error } = useStoryTimeFonts();
  const [systemReducedMotion, setSystemReducedMotion] = useState(true);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setSystemReducedMotion(value);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReducedMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const value = useMemo(() => ({
    theme: themeAt(timeOfDay),
    fontsLoaded: loaded,
    fontError: error,
    reducedMotion: reducedMotion ?? systemReducedMotion,
  }), [timeOfDay, loaded, error, reducedMotion, systemReducedMotion]);

  return <StoryTimeContext.Provider value={value}>{children}</StoryTimeContext.Provider>;
}

export function useStoryTime() {
  return useContext(StoryTimeContext);
}
