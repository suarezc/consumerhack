import { useFonts } from 'expo-font';

export const fontFamilies = {
  voice: 'Alegreya_400Regular',
  italic: 'Alegreya_400Regular_Italic',
  meta: 'SourceSans3_400Regular',
  text: 'SourceSans3_400Regular',
  control: 'SourceSans3_600SemiBold',
} as const;

export function useStoryTimeFonts() {
  const [loaded, error] = useFonts({
    [fontFamilies.voice]: require('../../assets/fonts/Alegreya-Regular.ttf'),
    [fontFamilies.italic]: require('../../assets/fonts/Alegreya-Italic.ttf'),
    [fontFamilies.text]: require('../../assets/fonts/SourceSans3-Regular.ttf'),
    [fontFamilies.control]: require('../../assets/fonts/SourceSans3-SemiBold.ttf'),
  });

  return { loaded, error };
}
