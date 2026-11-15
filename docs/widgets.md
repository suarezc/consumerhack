# Giving-streak widgets (opt-in; not in the initial TestFlight)

This is a native SwiftUI layout compiled by SDK58 `expo-widgets` into WidgetKit, not an HTML screenshot. It supports small/medium Home Screen and accessory circular Lock Screen. Transparent offline illustrations are derived from the unchanged supplied board. Bricolage/Inter are extension-only. Native compilation, provisioning, device screenshots and app mounting remain with Build/QA; JavaScript/prebuild checks are not native visual proof.

## Activation boundary

This branch changes no `app.json`, app routes/providers, Convex function, shared tree visual or existing typography. Dependencies are a separate commit; the config plugin and widget source do nothing until the release owner opts in and mounts the app bridge. Do not cherry-pick the dependency commit into the first candidate unless its owner wants that change: native modules still autolink even with no extension enabled.

SDK58 versions installed with `npx expo install`: `expo-widgets ~58.0.28`, `expo-file-system ~58.0.13`, `expo-asset ~58.0.21`. `@expo/ui ~58.0.28` was already installed. Expo Go cannot run widgets. No Xcode or Android SDK is installed here. Do not start competing EAS/Revyl builds, Apple/Expo sign-in or identifier registration.

The release owner may later add this local plugin to their config:

```js
["./plugins/withStoryTimeWidgets.cjs", {
  enabled: false,
  bundleIdentifier: "com.charlessuarez.storytime.widgets",
  groupIdentifier: "group.com.charlessuarez.storytime.widgets",
}]
```

Names above are the accepted **proposal**, not registrations. Default/absent `enabled` is false and returns config unchanged, even if no IDs exist. To enable, the coordinator must approve/register the extension and one App Group for the approved containing bundle `com.charlessuarez.storytime`, choose the Apple team and provision both targets. Do not invent a team ID. Existing EAS project is `@suarezc/storytime` / `9c1d5974-abc5-4039-912c-7b79809cd460`; this implementation changes none of it.

Verified upstream plugin option names are `bundleIdentifier`, `groupIdentifier`, `widgets[].name`, `widgets[].ios.supportedFamilies`, `widgets[].ios.contentMarginsDisabled`, `widgets[].ios.initialLayout`, `enableAndroid`, `enablePushNotifications`, `frequentUpdates`. The generated Xcode target is fixed at **ExpoWidgetsTarget**; its bundle ID and App Group support the explicit overrides above. Widget kind is `StoryTimeGiving`. The local wrapper registers the three families and bundled initial neutral layout, adds font resources/`UIAppFonts` only to that extension, and sets `extra.storytimeWidgetsEnabled=true` only when enabled. It never registers identifiers with Apple.

No shared keychain, credential group, push/APNs, frequent Live Activity updates, background fetch, network query or payment action is used. Upstream expo-widgets automatically declares `NSSupportsLiveActivities` and generates an unused Live Activity type when enabled, even though this feature never starts one; it adds no push entitlement with `enablePushNotifications:false`. Android widgets remain disabled. Use a clean/default CNG prebuild when changing the target; generated native folders are never committed or hand-edited.

## App-owned query seam (CONS-7/CONS-11)

Use one long-lived `createNativeWidgetSync(config.extra.storytimeWidgetsEnabled === true)` per app process, wrapped by `createWidgetSessionBridge(sync)`. It safely returns `unavailable` when disabled, on non-iOS, without the native module/App Group, or on native/file failures. It imports native registration lazily, so merely including the source does not require Expo Go to load `ExpoWidgets`.

1. On initial session hydration or selected-tree/account change, call `bridge.beginScope()` and retain its returned handle only for that session/tree subscription. On logout/unmount call `handle.close()`. Beginning a scope clears the native timeline; its `publish` awaits that clear. Old handles drop late callbacks and cannot clear a newer scope. The clear also invalidates in-flight image preparation and replaces scheduled future entries. No identity value is needed by this bridge at all.
2. Subscribe to the existing current-tree `days.today` authenticated app query. Only a resolved **real, non-demo** response with the canonical fields is passed to `handle.publish(day)`, which projects through `snapshotFromVerifiedDay(day)` before sync. Query loading/errors leave a previously confirmed same-scope snapshot alone; null/denied/no-tree/demo clears it. No query is executed by the extension and no bearer identity is copied into shared storage.
3. Refresh from the verified webhook-backed query/subscription, not checkout browser closure. Every publish replaces facts. No fruit/streak increment, success animation, checkout creation or payment request exists here. Duplicate/older snapshots are ignored; corrected/newer query facts replace previous data.
4. Subscribe/requery on app foreground and at the backend boundary through the app's existing lifecycle owner. The widget does not launch the app or query Convex in the background. At the next 06:00 UTC boundary its prewritten neutral entry asks to open the app, rather than manufacturing a new day's count or broken state.

`AuthoritativeWidgetDay` is a structural subset of the frozen charity DTO, not a new backend endpoint. It requires top-level `isDemo:false`, `totalRaisedCents`, `answererCount`, viewer-own paid `fruits`, plus `streaks.{clock,giving,currency,isDemo,undatedPaidCount}`. Clock is `{now,date,nextBoundaryAt}`. Giving is `{count,status,totalCents}` with status `current|at_risk|none`. The private lifetime `totalCents` is converted to `hasPriorGiving = totalCents > 0` and discarded; `historyComplete = undatedPaidCount === 0`. Missing totals/unknown canonical fields are not replaced with zero. The old base branch lacks the new charity DTO, so this adapter is deliberately not mounted against that older backend. Test figures are fixtures only.

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
```

The last command copies the project into a disposable local scratch directory, uses **unregistered example IDs only**, prebuilds default-disabled and enabled iOS configurations with `--no-install`, checks target/families/entitlements/font build-file references, and bundles the real layout + published isolated JS runtime with Metro. It evaluates 60 family/state/light-dark/Always-On native view descriptions plus expired data. It never compiles Swift, installs an app, invokes cloud builds, provisions, authenticates, edits the real app config or leaves generated folders in this repository. The state tests cover states/maturity, 06:00/DST/day cutovers, fades/staleness, canonical projection, duplicate/late query facts, unavailable support, offline failure/retry and identity clearing/races. They do **not** re-prove payment signature verification or webhook idempotency; backend owns those tests.

Still required through the existing cloud release owner after later opt-in: build/sign extension; gallery/cold install; true small/medium/circular screenshots for watered/thirsty; correct fonts, crop, tint, VoiceOver and Always-On on device; app-killed fade/cutover; stale/offline render; scope clearing; and root deep-link flow through Yesterday, answer then watering. A web reference render or JS view description is never proof these native checks passed.

## Sources

- https://docs.expo.dev/versions/v58.0.0/
- https://docs.expo.dev/llms.txt
- https://docs.expo.dev/versions/v58.0.0/sdk/widgets/
- https://docs.expo.dev/versions/v58.0.0/sdk/ui/swift-ui/modifiers/
- https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/
- Installed `expo-widgets@58.0.28`: `plugin/src/ios/withIosWidgets.ts`, `withWidgetSourceFiles.ts`, `withEasConfig.ts`, `ios/WidgetObject.swift`, `ios/Widgets/TimelineProvider.swift` and `bundle/index.ts` were inspected; supported options/runtime verified rather than inferred from older Expo APIs.
