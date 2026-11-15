# Widget-only artwork

Peach geometry, blossom, withered new bud, Lock Screen silhouettes and canopy are derived from the supplied `design/streak-fruit.html` in project Drive. The original board is unchanged. SVG sources are retained here; transparent PNGs are the offline illustration assets inside a native SwiftUI layout, not screenshots of a widget. Thirsty PNGs apply the board's saturation/brightness values at morning/afternoon/evening. No face; thirsty background is provided by the native layout.

Widget maturity is green/small at 1, blush at 3, ripe at 7, gold at 30 (thresholds). This is the original personal giving-streak peach metaphor, separate from response fruit and shared-tree paid lights. No fruit or light collection is read by the widget adapter.

The medium tree preserves the board's complete illustration. Its decorative fruit is not a payment/count projection; only the accompanying answer count and gross sandbox total are query facts.

Static widget-only fonts: Bricolage Grotesque (700, optical size14, width100) and Inter (400, optical size14), instantiated from Google Fonts variable sources. PostScript names are `BricolageGrotesque-14ptBold` and `Inter-Regular`. The original OFL licenses are included beside them. Sources:

- https://github.com/google/fonts/tree/main/ofl/bricolagegrotesque
- https://github.com/google/fonts/tree/main/ofl/inter

The opt-in config plugin copies/registers these only in `ExpoWidgetsTarget`; main app fonts remain untouched. Rendering/font availability still needs cloud iOS validation.
