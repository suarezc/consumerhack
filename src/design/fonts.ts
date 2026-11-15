import { useFonts } from 'expo-font';

export const fontFamilies = {
  voice: 'Newsreader_400Regular',
  italic: 'Newsreader_300Light_Italic',
  meta: 'IBMPlexMono_400Regular',
} as const;

export function useStoryTimeFonts() {
  const [loaded, error] = useFonts({
    [fontFamilies.voice]: require('../../assets/fonts/Newsreader-Regular.ttf'),
    [fontFamilies.italic]: require('../../assets/fonts/Newsreader-LightItalic.ttf'),
    [fontFamilies.meta]: require('../../assets/fonts/IBMPlexMono-Regular.ttf'),
  });

  return { loaded, error };
}
