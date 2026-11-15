# StoryTime visual kit

Import from `@/design`. These are presentation components: routes own queries, answer-access rules, payment state, navigation, and mutations. No route or Tree contract changes are included.

## Root integration

Inside the existing safe-area/session providers, wrap the navigator with:

```tsx
<StoryTimeProvider timeOfDay={timeOfDay}>
  <Stack screenOptions={{ headerShown: false }} />
</StoryTimeProvider>
```

`timeOfDay` is 0 at 06:00 and 1 at 21:00, clamped. Use the same value as Tree, including a demo's compressed clock. The palette follows `design/tree.html`, not system appearance. The optional `reducedMotion` override is useful for tests; omit it to respect the OS. The safe default is reduced motion until the OS preference resolves. `useStoryTime()` returns `{theme, fontsLoaded, fontError, reducedMotion}`. The provider calls `useStoryTimeFonts()` once; Build does not need a second call or a font-loading gate. Fonts are bundled `require()` assets, work offline, and fall back to system serif/monospace while pending or on failure. Do not hold the splash open for fonts.

## Primitives

- `StoryText`: normal RN Text props plus `variant="title" | "question" | "body" | "caption" | "meta"`, and optional `color`. Question uses light italic Newsreader; meta uses IBM Plex Mono. Default text uses `theme.text`, a contrast-safe companion to StoryScreen's dusk scrim. Raw `theme.ink` still preserves the reference ramp exactly; its dusk interpolation is not suitable for body copy. For custom screen backgrounds, pair `theme.text` with `theme.screenScrim`, or use a dark backing panel with paper text. On dark cards/hills explicitly use `color={theme.paper}` (or lantern/muted).
- `StoryButton`: normal Pressable props except children, plus required `label`, optional `loading`, `tone="primary" | "quiet"`. Loading disables repeated presses and exposes accessibility busy state. Minimum height is 48; long labels wrap.
- `StoryScreen`: `children`, `scrollable=true`, `keyboardAvoiding=true`, `keyboardVerticalOffset=0`, `edges`, `style`, `contentStyle`. It paints the daily sky, adds safe-area spacing and 24-point content margins, and caps content at 560. It is a complete screen wrapper, not an inner card. For full-bleed Tree composition, use its palette directly instead of nesting another padded screen. If tabs/navigation already reserve a safe edge, exclude it with `edges`. Android's keyboard avoidance and any edge-to-edge config need validation in the integrated native build. Expo Router SDK 58 web safe areas use CSS `env(safe-area-inset-*)`; routes must supply that web CSS (do not add a second SafeAreaProvider).
- `StoryField`: normal TextInput props plus required `label` and optional `error`. Routes control value/onChangeText, capitalization, return key, submission, and multiline sizing. Label and error are exposed to assistive technology.
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
  onClose={closeAnswer}
  onNote={openPrivateNoteComposer}
  onLantern={startCheckout}
/>
```

`AnswerCard` also accepts `noteLoading`, `lanternLoading`, `error`, and `children` for route-owned details. Its modal scrolls long content, honors safe insets, dismisses through Close/backdrop/Android back, and only renders a note action for someone else's answer. Do not provide an answer until the server authorizes reading it. A lantern callback requests checkout; it does not mean payment succeeded.

`origin?: {x,y} | null` uses window coordinates. It grows from that point over 600 ms; without a valid origin it fades for 180 ms. Reduced motion shows it immediately. Tree's public callback is still only an index. An outer tree wrapper may best-effort capture `pageX/pageY` without taking the responder, but this is **not** a verified blossom center, and native WebView touch capture is not guaranteed. Only pass a recent, stationary tap that selected this answer. Clear it on touch start/cancel/close/selection change, reject drags, and use null for programmatic or accessibility selections. Prefer the fade until capture has been verified on the integrated native target. Do not guess an index-to-coordinate mapping or change Tree props.

## Verification boundary

Component/browser checks do not prove integrated route behavior, native WebView touch capture, keyboard avoidance, or physical-device performance. Icon/splash changes need a new native preview/production build; Expo Go/dev-client splash behavior is not release splash evidence. The committed SVG sources and font licenses accompany the raster/font assets.
