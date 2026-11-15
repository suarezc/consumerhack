# Offline typography

The isolated warm-typography successor now uses Alegreya + Source Sans3; see [WARM-TYPOGRAPHY.md](WARM-TYPOGRAPHY.md) for exact files, licenses, roles and hashes. The Newsreader/Plex record below belongs to the earlier frozen native/product checkpoint and its binaries remain retained, not loaded by the successor.

These are complete, unmodified static TrueType faces, bundled locally so font loading never needs a network request. File names were shortened; the font binaries were not changed or subsetted.

| Local file | Face | Upstream file |
| --- | --- | --- |
| `Newsreader-Regular.ttf` | Newsreader, regular 400 | `newsreader/400Regular/Newsreader_400Regular.ttf` |
| `Newsreader-LightItalic.ttf` | Newsreader, light italic 300 | `newsreader/300Light_Italic/Newsreader_300Light_Italic.ttf` |
| `IBMPlexMono-Regular.ttf` | IBM Plex Mono, regular 400 | `ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf` |

## Sources and licenses

Downloaded from the [Expo Google Fonts distribution](https://github.com/expo/google-fonts/tree/1e8cb91578b80d3cd8073be48c81fa24b09852b1/font-packages) at revision `1e8cb91578b80d3cd8073be48c81fa24b09852b1`, under `font-packages/` and the paths above. The adjacent `LICENSE_FONT` files are preserved as `Newsreader-OFL.txt` and `IBMPlexMono-OFL.txt`.

- Newsreader: Copyright 2020 The Newsreader Project Authors. Original project: https://github.com/productiontype/Newsreader.
- IBM Plex Mono: Copyright © 2017 IBM Corp., with Reserved Font Name “Plex”. Original project: https://github.com/IBM/plex.

Both fonts use the SIL Open Font License 1.1. They may be embedded and redistributed with this app, including commercial use, while preserving the copyright and license notices. The fonts must not be sold by themselves. Modified versions must follow the license, including its reserved-name restrictions. See the full accompanying licenses for the governing terms.

## SHA-256

```text
da96d8de6be82192c7e6a6dea423167b573da3fae6e418fab3c86a0bafff523e  Newsreader-Regular.ttf
e6bcea65c5ef5fb07b20634dc4191246929f7c55c002ecb50939f5a59d19384f  Newsreader-LightItalic.ttf
04d49f898dcf5fe097490c7f7bb9c95e876e8b26a394fa10d13773fc6576d17e  IBMPlexMono-Regular.ttf
```

`src/design/fonts.ts` registers each face under a distinct family alias using `expo-font`. Use the exported `fontFamilies` values directly; the italic alias already contains the light italic face, so synthetic weight or italic styling is unnecessary. `StoryTimeProvider` loads the bundled assets without blocking content; primitives use system-font fallbacks while loading or on failure. Do not hold the splash screen open for font loading.
