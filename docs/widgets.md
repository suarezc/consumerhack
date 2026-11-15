# Giving-streak widgets (opt-in; separate enabled and disabled candidates)

**Incomplete source checkpoint — not an activation handoff.** Work was paused for the first playable core demo after scalar-only projection and native firefly shape edits passed TypeScript, lint and 43 widget unit tests. The changed vector runtime/prebuild script has not been run; no native rendering or signing was attempted. The older implementation/asset details below have not yet been reconciled and are historical until resumption. The independently reviewed privacy-only activation-source baseline remains commit `350d473b96dd37adf4f4675b3a0e83b470a05b69` on PR #14; it still has historical peach semantics and is not product-accepted for activation.

**Activation is paused for the response-fruit / paid-light product change.** This branch still has the historical giving-peach presentation pending a separately scoped giving-light/firefly motif update. Capability work remains reusable, but the old fruit semantics and visual checks are not current product acceptance. The privacy clear fix is independent of that semantic change; no Apple/build action is authorized here.

This is a native SwiftUI layout compiled by SDK58 `expo-widgets` into WidgetKit, not an HTML screenshot. It supports small/medium Home Screen and accessory circular Lock Screen. Transparent offline illustrations are derived from the unchanged supplied board. Bricolage/Inter are extension-only. Native compilation, provisioning, device screenshots and app mounting remain with Build/QA; JavaScript/prebuild checks are not native visual proof.

## Activation boundary

This branch changes no `app.json`, app routes/providers, Convex function, shared tree visual or existing typography. Dependencies are a separate commit; the config plugin and widget source do nothing until the release owner opts in and mounts the app bridge. Charles has authorized preparing an isolated enabled candidate for the earliest validated build. Keep the separately buildable disabled core candidate widget-dependency-free: native modules still autolink even with no extension enabled. Activation preparation is not merge permission or native acceptance.

SDK58 versions installed with `npx expo install`: `expo-widgets ~58.0.28`, `expo-file-system ~58.0.13`, `expo-asset ~58.0.21`. `@expo/ui ~58.0.28` was already installed. Expo Go cannot run widgets. No Xcode or Android SDK is installed here. Do not start competing EAS/Revyl builds, Apple/Expo sign-in or identifier registration.

The release owner may later add this local plugin to their config:

```js
["./plugins/withStoryTimeWidgets.cjs", {
  enabled: false,
  bundleIdentifier: "com.charlessuarez.storytime.widgets",
  groupIdentifier: "group.com.charlessuarez.storytime.widgets",
}]
```

Names above are the accepted capability plan, not registrations. Default/absent `enabled` is false and returns config unchanged, even if no IDs exist. For the isolated enabled candidate, CONS-7 changes this explicit option to `true`; the coordinator alone registers/provisions the extension and one App Group for containing bundle `com.charlessuarez.storytime` on the selected team `432CDA2QK3`. Existing EAS project is `@suarezc/storytime` / `9c1d5974-abc5-4039-912c-7b79809cd460`; this implementation changes none of it. The existing widget-disabled root provisioning profile does not prove the enabled candidate signs.

Verified upstream plugin option names are `bundleIdentifier`, `groupIdentifier`, `widgets[].name`, `widgets[].ios.supportedFamilies`, `widgets[].ios.contentMarginsDisabled`, `widgets[].ios.initialLayout`, `enableAndroid`, `enablePushNotifications`, `frequentUpdates`. The generated Xcode target is fixed at **ExpoWidgetsTarget**; its bundle ID and App Group support the explicit overrides above. Widget kind is `StoryTimeGiving`. The local wrapper registers the three families and bundled initial neutral layout, adds font resources/`UIAppFonts` only to that extension, and sets `extra.storytimeWidgetsEnabled=true` only when enabled. It never registers identifiers with Apple.

No shared keychain, credential group, push/APNs, frequent Live Activity updates, background fetch, network query or payment action is used. Upstream expo-widgets automatically declares `NSSupportsLiveActivities` and generates an unused Live Activity type when enabled, even though this feature never starts one; it adds no push entitlement with `enablePushNotifications:false`. Android widgets remain disabled. Use a clean/default CNG prebuild when changing the target; generated native folders are never committed or hand-edited.

## App-owned query seam (CONS-7/CONS-11)

Use one long-lived `createNativeWidgetSync(config.extra.storytimeWidgetsEnabled === true)` per app process, wrapped by `createWidgetSessionBridge(sync)`. It safely returns `unavailable` when disabled, on non-iOS, without the native module/App Group, or on native/file failures. It imports native registration lazily, so merely including the source does not require Expo Go to load `ExpoWidgets`.

1. On initial session hydration or selected-tree/account change, call `bridge.beginScope()` and retain its returned handle only for that session/tree subscription. On logout/unmount call `handle.close()`. Beginning a scope clears the native timeline; its `publish` awaits that clear. Neutral clearing bypasses stalled artwork preparation and starts a fresh publication chain. Old handles, preparation completions and delayed clears are generation-guarded so they cannot overwrite a newer scope. No identity value is needed by this bridge at all.
2. Subscribe to the existing current-tree `days.today` authenticated app query. Only a resolved **real, non-demo** response with the canonical fields is passed to `handle.publish(day)`, which projects through `snapshotFromVerifiedDay(day)` before sync. Query loading/errors leave a previously confirmed same-scope snapshot alone; null/denied/no-tree/demo clears it. No query is executed by the extension and no bearer identity is copied into shared storage.
3. Refresh from the verified webhook-backed query/subscription, not checkout browser closure. Every publish replaces facts. No fruit/streak increment, success animation, checkout creation or payment request exists here. Duplicate/older snapshots are ignored; corrected/newer query facts replace previous data.
4. Subscribe/requery on app foreground and at the backend boundary through the app's existing lifecycle owner. The widget does not launch the app or query Convex in the background. At the next 06:00 UTC boundary its prewritten neutral entry asks to open the app, rather than manufacturing a new day's count or broken state.

Against screens `47a1a535ed6b27ae88dfaa9bef8e9267b622c976`, the existing `RitualProvider.today` is the app-owned query seam. Publish changes to that resolved object, not the provider's one-second `now` animation tick. Keep scope handles tied to session/selected-tree lifecycle even while the query is loading; late old-scope callbacks must use their old handle and be ignored. Root stays `storytime://`.

`AuthoritativeWidgetDay` is a structural subset of the actual charity DTO, not a new backend endpoint. It requires **nested `day.{date,isDemo:false}`**, top-level `totalRaisedCents`, `answererCount`, viewer-own paid `fruits`, plus `streaks.{clock,giving,currency,isDemo,undatedPaidCount}`. Clock is `{now,date,nextBoundaryAt}`; its date must match the selected real day. Giving is `{count,status,totalCents}` with status `current|at_risk|none`. The private lifetime `totalCents` is converted to `hasPriorGiving = totalCents > 0` and discarded; `historyComplete = undatedPaidCount === 0`. Missing totals/unknown canonical fields are not replaced with zero. The base branch lacks the new charity DTO, so mounting requires the integrated canonical backend. Test figures are fixtures only. This shape was cross-checked against backend `758d60d6e047def8158b92585e0629c544a2c4de`; there is no top-level Today `isDemo` field.

The snapshot is a versioned presentation projection, not a stored authoritative streak counter:

```ts
{
  version: 1, asOf, dayKey, nextBoundaryAt,
  giving: { count, status }, hasPriorGiving, historyComplete,
  fruitCount, goldenFruitCount, totalRaisedCents, answererCount,
  currency: "USD", sandbox: true
}
```

`fruitCount/goldenFruitCount` count only the viewer's `source:'whop'` query fruits. They stay in the app adapter's projection; unused counts, IDs, day keys and lifetime money are not persisted in the extension's rendered props. No device ID, provider/payment ID, invite code, answer text, user name, tree name or access token reaches the extension. The App Group receives only static sanitized artwork and dated display props (count, state, copy, formatted public totals, expiry and local image paths). No separate raw snapshot file or authoritative counter is written. UserDefaults in the App Group is not a secret store. Lock Screen/Home Screen privacy and personalization require product review; root `privacySensitive()` allows system redaction but is not authentication. A clear requests WidgetKit reload; iOS may retain an already-rendered image until it schedules that refresh.

## States, clock and navigation

`current` → healthy; `at_risk` → thirsty. `none` with complete history and no prior giving → blossom; `none` with complete history and prior giving → withered/new bud. Incomplete historical attribution renders neutral, never/broken is not guessed. Counts always come from the query. Green/small1, blush3, ripe7 and gold30 are widget maturity thresholds, not canonical shared-tree historical gold at exactly3/7/30. The generic medium canopy intentionally has no illustrative paid fruit and accompanies today's public gross sandbox total and answer count. It never implies funds reached S.A.C.K.

The app supplies the authoritative 06:00 UTC boundary. Within that confirmed ritual day, future timeline entries fade thirst at **14:00 UTC** and **22:00 UTC** (8/16 hours after the ritual starts), with an aging label after six hours and a neutral entry at the next boundary. All entries show an as-of time. Absolute boundary timestamps are not shifted to receipt time, which would revive stale offline data. Future-dated/inconsistent/expired snapshots fail closed. The native layout also checks absolute expiry when evaluated, defending against an old gallery snapshot. OS budgets can delay presentation: no every-second, exact-time or off-app payment freshness promise is made.

Every family opens **`storytime://`**, the approved semantic root. No identity, selected tree, date, payment metadata or day token appears in the URL. Root preserves the current session, Yesterday first-open and answer-before-watering guards; the widget never bypasses them. There are no buttons that water or charge from the widget. Lock Screen shows a filled watered silhouette or drooped outline for thirsty; the system controls monochrome/tint and Always-On uses the outline. Cold/gallery/missing data shows a neutral refresh affordance, never fake counts.

## Verification

```sh
npx tsc --noEmit
npx expo lint
npx vitest run tests/widgets.test.ts
node scripts/verify-storytime-widgets.cjs
node scripts/verify-storytime-widgets.cjs --approved-plan
```

The verification script copies the project into a disposable local scratch directory and prebuilds default-disabled/enabled iOS configurations with `--no-install`. Default uses unregistered example IDs; `--approved-plan` uses the accepted root/extension/group/team above for **local generation only**, printing sanitized root/extension entitlements and EAS target metadata. It checks both targets' App Group, no extension push entitlement, EAS `appExtensions`, families and font build-file references, then bundles the real layout + published isolated JS runtime with Metro. It evaluates 60 family/state/light-dark/Always-On native view descriptions plus expired data. It never compiles Swift, installs an app, invokes cloud builds, provisions, authenticates, edits the real app config or leaves generated folders in this repository. The state tests cover states/maturity, 06:00/DST/day cutovers, fades/staleness, actual nested Today DTO, canonical projection, duplicate/late query facts, unavailable support, offline failure/retry and identity clearing/races. They do **not** re-prove payment signature verification or webhook idempotency; backend owns those tests.

Still required through the existing cloud release owner after later opt-in: build/sign extension; gallery/cold install; true small/medium/circular screenshots for watered/thirsty; correct fonts, crop, tint, VoiceOver and Always-On on device; app-killed fade/cutover; stale/offline render; scope clearing; and root deep-link flow through Yesterday, answer then watering. A web reference render or JS view description is never proof these native checks passed.

## Sources

- https://docs.expo.dev/versions/v58.0.0/
- https://docs.expo.dev/llms.txt
- https://docs.expo.dev/versions/v58.0.0/sdk/widgets/
- https://docs.expo.dev/versions/v58.0.0/sdk/ui/swift-ui/modifiers/
- https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/
- Installed `expo-widgets@58.0.28`: `plugin/src/ios/withIosWidgets.ts`, `withWidgetSourceFiles.ts`, `withEasConfig.ts`, `ios/WidgetObject.swift`, `ios/Widgets/TimelineProvider.swift` and `bundle/index.ts` were inspected; supported options/runtime verified rather than inferred from older Expo APIs.
