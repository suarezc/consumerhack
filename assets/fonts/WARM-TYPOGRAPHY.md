# Warm typography successor

Charles selected Alegreya and Source Sans 3 for the isolated response-fruit/bundle-lights concept. Alegreya regular400 is the upright book-serif question/title voice; Source Sans3 regular400 is body/caption/metadata, and semibold600 is controls. Sentence case and normal tracking replace mono/all-caps. The italic alias remains available for existing callers, but questions no longer default to italic.

All four files are complete, unmodified static TrueType fonts from Expo Google Fonts revision `1e8cb91578b80d3cd8073be48c81fa24b09852b1` under `font-packages/`. No npm package, native module, manifest change or remote font request is added. Existing expo-font loads local require assets without a splash gate; readable system serif/sans fallbacks remain available. Legacy Newsreader/Plex binaries are retained for the earlier frozen candidate but no longer loaded by this successor.

| Local file | Immutable upstream path | SHA-256 |
| --- | --- | --- |
| Alegreya-Regular.ttf | alegreya/400Regular/Alegreya_400Regular.ttf | 79ded2d9fbb43f5086ce1cd82f199e6ae9819c0974e626fa2042c2bc8081f478 |
| Alegreya-Italic.ttf | alegreya/400Regular_Italic/Alegreya_400Regular_Italic.ttf | 41568ea72a05e2719ca5fb36c164a39f91b25b4a0eb0dbaf7a227f2b592251b4 |
| SourceSans3-Regular.ttf | source-sans-3/400Regular/SourceSans3_400Regular.ttf | 7ca2b9c4677ce81daf8a7feafb1680f5d228065698b500c5a24e22831e2ae849 |
| SourceSans3-SemiBold.ttf | source-sans-3/600SemiBold/SourceSans3_600SemiBold.ttf | 554fa345ebef3febe9a6233a0b25ee38000dd1687c8d6ed5fafeaa9bf1e0cd78 |

The upstream LICENSE_FONT text is preserved as Alegreya-OFL.txt and SourceSans3-OFL.txt, with line endings/trailing whitespace normalized only. Both use SIL Open Font License1.1, permitting app embedding/redistribution with their copyright and license notices. Alegreya is Copyright2011 The Alegreya Project Authors (https://github.com/huertatipografica/Alegreya). Source Sans3 is Copyright2010–2020 Adobe, with reserved font name Source. Font binaries are not renamed internally, modified or subsetted; they are not sold separately. Full accompanying licenses govern use.

This typography/timeline successor starts from reviewed#11 but is not merged into or applied to the in-flight native candidate. Native font loading and physical-device rendering require separate QA; a browser font-ready result does not establish them.
