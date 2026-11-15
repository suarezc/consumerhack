# StoryTime artwork

Original vector artwork created for this repository, using `design/tree.html` as the visual reference. No stock images, downloaded artwork, or generated-image service assets are used. The SVGs are the editable source; the PNGs have no runtime dependency on SVG rendering or a WebView.

The shared mark is a thin, organically branching tree with rose/ivory blossoms, one amber personal blossom, muted blue leaves, and an indigo hill. Its palette comes from the reference: dusk `#0b1030`, distant hill `#171c44`, foreground hill `#090c22`, paper `#f6efe6`, personal blossom `#ffd27a`.

| Output | Dimensions | Source / treatment |
| --- | --- | --- |
| `../images/icon.png` | 1024 × 1024, opaque RGB | `storytime-tree.svg`, full scene with no pre-rounded corners |
| `../images/splash-icon.png` | 1024 × 1024, transparent RGBA | `storytime-tree.svg`, background group removed |
| `../images/android-icon-foreground.png` | 1024 × 1024, transparent RGBA | Same tree, background removed, `translate(102.4 102.4) scale(.8)` to keep the mark within the central adaptive-icon safe zone |
| `../images/android-icon-monochrome.png` | 1024 × 1024, transparent RGBA | Foreground alpha mask in solid white, for Android themed icons |
| `../images/favicon.png` | 64 × 64, opaque RGB | `favicon.svg`, a simplified personal blossom for small browser tabs |
| `tree.png` | 384 × 384, transparent RGBA | `storytime-tree.svg`, background removed, `translate(-54 -64) scale(.48)` |
| `sapling.png` | 384 × 384, transparent RGBA | `sapling.svg`, an intentionally bare young tree for a missed day |

The Grove assets are colored at dusk, not tint-mask silhouettes. Render with `resizeMode="contain"`; do not apply `tintColor` unless a deliberately monochrome treatment is wanted. Their root baselines are aligned near the bottom of their square canvases, so a row can show growth without each tree appearing the same size. PNGs were rasterized with the system librsvg/Cairo renderer and losslessly optimized with Pillow; no new app dependencies were installed.

`app.json` uses a fixed light native interface style while the scene controls its own palette. The splash and adaptive-icon background are `#0b1030`. Native icon/splash changes require a new build; Expo Go or a development client does not verify the release splash experience.
