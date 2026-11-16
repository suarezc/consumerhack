# Warm typography

Alegreya regular 400 is the upright question/title voice. Source Sans 3 regular 400 is body, caption and metadata; semibold 600 is controls. Metadata and controls use sentence case and normal tracking.

The three unmodified static TrueType files come from Expo Google Fonts revision `1e8cb91578b80d3cd8073be48c81fa24b09852b1`, under `font-packages/`:

| Local file | Upstream path | SHA-256 |
| --- | --- | --- |
| Alegreya-Regular.ttf | alegreya/400Regular/Alegreya_400Regular.ttf | 79ded2d9fbb43f5086ce1cd82f199e6ae9819c0974e626fa2042c2bc8081f478 |
| SourceSans3-Regular.ttf | source-sans-3/400Regular/SourceSans3_400Regular.ttf | 7ca2b9c4677ce81daf8a7feafb1680f5d228065698b500c5a24e22831e2ae849 |
| SourceSans3-SemiBold.ttf | source-sans-3/600SemiBold/SourceSans3_600SemiBold.ttf | 554fa345ebef3febe9a6233a0b25ee38000dd1687c8d6ed5fafeaa9bf1e0cd78 |

The adjacent Alegreya-OFL.txt and SourceSans3-OFL.txt preserve the upstream copyright and SIL Open Font License 1.1 notices, with whitespace normalization only. The fonts are not modified or subsetted.

The existing expo-font hook loads local require assets on iOS, Android and web without a network font request or splash gate. System serif/sans fallbacks remain available while loading or on error. Legacy Newsreader/Plex assets remain for historical references but are no longer loaded by the app.
