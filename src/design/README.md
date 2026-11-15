# StoryTime visual kit

Import from `@/design`. These are presentation components: routes own queries, answer-access rules, payment state, navigation, and mutations. No route or Tree contract changes are included.

## Tree-first acceptance baseline

`design/tree.html` is the visual acceptance baseline, not inspiration. For Today/Bloom mobile web, preserve the shared renderer's full-bleed sky/hills, original top words, low floating answer card, and original controls. Do **not** wrap that scene in `StoryScreen`: its 24-point margins, symbolic hill, and contrast scrim would alter the reference. Do not put its canvas in a generic padded panel. Reuse the provider, font families, and raw palette tokens without adding that scrim over the renderer. The renderer stays data-only canvas; question text, controls, and answer cards remain app-owned overlays.

`OnboardingIntro` and `GroveThumbnail` use symbolic static tree artwork for their specific secondary surfaces; neither replaces the live tree. `AnswerCard` is an undimmed, low floating overlay above app-owned controls, with the reference's translucent dark surface and narrow border. Native buttons have 48-point minimum targets and wrapping labels rather than reproducing the reference's desktop dimensions.

## Root integration

Inside the existing safe-area/session providers, wrap the navigator with:

```tsx
<StoryTimeProvider timeOfDay={timeOfDay}>
  <Stack screenOptions={{ headerShown: false }} />
</StoryTimeProvider>
```

`timeOfDay` is 0 at 06:00 and 1 at 21:00, clamped. Use the same value as Tree, including a demo's compressed clock. The palette follows `design/tree.html`, not system appearance. The optional `reducedMotion` override is useful for tests; omit it to respect the OS. The safe default is reduced motion until the OS preference resolves. `useStoryTime()` returns `{theme, fontsLoaded, fontError, reducedMotion}`. The provider calls `useStoryTimeFonts()` once; Build does not need a second call or a font-loading gate. Fonts are bundled `require()` assets, work offline, and fall back to system serif/monospace while pending or on failure. Do not hold the splash open for fonts.

For native screens, set the installed `expo-status-bar` component's `style` explicitly from the scene: use `light` over night/dark panels and `dark` over dawn/day sky. Do not use its default `auto`, which follows system appearance rather than the scene. `theme.text === '#f6efe6'` identifies StoryScreen's light-text phase; a full-bleed renderer should use its actual header background instead.

## Primitives

- `StoryText`: normal RN Text props plus `variant="title" | "question" | "body" | "caption" | "meta" | "control"`, and optional `color`. The isolated warm successor uses upright Alegreya for title/question, Source Sans3 regular for body/caption/metadata, and Source Sans3 semibold for controls. Metadata is sentence-case with normal tracking, not monospace/all-caps. Default text uses `theme.text`, a contrast-safe companion to StoryScreen's dusk scrim. Raw `theme.ink` still preserves the reference ramp exactly; its dusk interpolation is not suitable for body copy. For custom screen backgrounds, pair `theme.text` with `theme.screenScrim`, or use a dark backing panel with paper text. On dark cards/hills explicitly use `color={theme.paper}` (or lantern/muted).
- `StoryButton`: normal Pressable props except children, plus required `label`, optional `loading`, `tone="primary" | "quiet"`. Loading disables repeated presses and exposes accessibility busy state. Minimum height is 48; long labels wrap.
- `StoryScreen`: `children`, `scrollable=true`, `keyboardAvoiding=true`, `keyboardVerticalOffset=0`, `edges`, `style`, `contentStyle`. It paints the daily sky, adds safe-area spacing and 24-point content margins, and caps content at 560. It is a complete screen wrapper, not an inner card. For full-bleed Tree composition, use its palette directly instead of nesting another padded screen. If tabs/navigation already reserve a safe edge, exclude it with `edges`. Android's keyboard avoidance and any edge-to-edge config need validation in the integrated native build. Expo Router SDK 58 web safe areas use CSS `env(safe-area-inset-*)`; routes must supply that web CSS (do not add a second SafeAreaProvider).
- `StoryField`: normal TextInput props plus required `label` and optional `error`, `labelColor`, `errorColor`. Defaults preserve the screen text color. Inside a route-owned dark panel at any time of day, use `labelColor={theme.paper}` and `errorColor={theme.lantern}` (or paper) so dawn's dark sky text is not applied to that panel. `style` affects only the input, not its label/error. Routes control value/onChangeText, capitalization, return key, submission, and multiline sizing. Label and error are exposed to assistive technology.
- `ScreenState`: required `status="loading" | "error" | "empty"`, `title`; optional `message`, `onRetry`. A retry button appears for an error with a callback.

## Consumers

`OnboardingIntro` takes `title`, `description`, `primaryLabel`, `onPrimary`; optional `secondaryLabel`, `onSecondary`, `loading`, `disabled`, `error`, and `children`. Use inside StoryScreen, with controlled join/create fields in children. Copy is supplied by Build; this does not create a separate onboarding state machine.

`GroveThumbnail` takes `dayLabel`, `answers`; optional `question`, `missed`, `timeOfDay=0.93`, `onPress`, `disabled`. Missed days show a bare sapling and are explicitly announced as missed. The tree artwork is a symbolic static thumbnail, not one dot per answer; the visible/accessibility count is exact. There is no animation or WebView per item. The mature artwork uses the reference dusk colors, with the supplied time controlling its backdrop. Use in a one-column mobile list or a grid whose items have enough room for large type; do not fix the text height.

```tsx
<AnswerCard
  open={selected !== null}
  answer={selected && {
    id: selected._id,
    text: selected.text,
    author: selected.displayName,
    isMine: selected.deviceId === deviceId,
  }}
  origin={selectionOrigin}
  controlsHeight={measuredControlBandHeight}
  onClose={closeAnswer}
  onNote={openPrivateNoteComposer}
  onLantern={startCheckout}
/>
```

Mount `AnswerCard` as the last sibling of the tree and controls inside the full-height screen's positioned root, outside any ScrollView or padded StoryScreen content. Keep it mounted and control visibility with `open`; this keeps web's polite live region present before answer text arrives. It is an absolute overlay, not a modal portal, and does not set modal accessibility semantics or trap focus. `controlsHeight` is the measured bottom control band, including its safe-area padding; it defaults to 120. The card sits 18 points above that band (at least above the bottom safe inset), caps width at 416, and scrolls long content within its measured parent's remaining safe height. Its nonanimated host is measured in window coordinates, so an origin is converted by subtracting the host's actual window-space center, not by assuming the parent starts at (0,0). Parent/keyboard size changes remeasure and settle motion without remounting focused fields or local drafts; only changing the answer ID or closing resets that subtree. The reference's 6px backdrop blur is applied on web; native uses the translucent panel fallback without a blur dependency. Outside the card, touches pass through to the tree and controls; there is no backdrop scrim or tap-blocking dismiss layer.

If a composer keeps the keyboard open, its route should put the full scene root inside its existing keyboard-avoidance owner so parent layout shrinks, or dismiss the keyboard before opening a read card. Do not nest a second keyboard-avoidance owner. Actual native keyboard behavior still needs integrated device validation; browser parent-resize checks are not a physical keyboard check.

It also accepts `noteLoading`, `lanternLoading`, `error`, and `children` for route-owned details. Answers are announced politely through a persistent web live region, Android's polite live region, and a queued low-priority iOS announcement. Dismissal uses Close, Android back, web Escape when the parent document has focus, or iOS accessibility escape. On web, dismissal restores the opener only when focus was inside the card; it never pulls focus away from another active control. There is no dialog role, modal announcement, or focus trap. A route may clear selection when it handles an outside/blank-tree tap. Only someone else's answer gets the note action. Do not provide an answer until the server authorizes reading it. A lantern callback requests checkout; it does not mean payment succeeded.

`origin?: {x,y} | null` uses window coordinates. It grows from that point over 600 ms; without a valid origin it fades for 180 ms. Reduced motion shows it immediately. Tree's public callback is still only an index. An outer tree wrapper may best-effort capture `pageX/pageY` without taking the responder, but this is **not** a verified blossom center, and native WebView touch capture is not guaranteed. Only pass a recent, stationary tap that selected this answer. Clear it on touch start/cancel/close/selection change, reject drags, and use null for programmatic or accessibility selections. Prefer the fade until capture has been verified on the integrated native target. Do not guess an index-to-coordinate mapping or change Tree props.

## Verification boundary

Component/browser checks do not prove integrated route behavior, native WebView touch capture, keyboard avoidance, or physical-device performance. Icon/splash changes need a new native preview/production build; Expo Go/dev-client splash behavior is not release splash evidence. The committed SVG sources and font licenses accompany the raster/font assets.
