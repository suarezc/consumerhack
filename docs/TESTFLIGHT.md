# Internal TestFlight preparation

This configuration prepares a cloud-built, App Store-signed iPhone binary for internal TestFlight testing. It does not authorize a public App Store release, external testing, account creation, certificate revocation or an upload of the generic shell. No build, signing, submission or Apple processing is proved by this file.

## Ownership and inspected state

CONS-1 is the sole Expo/Apple authentication and cloud build/signing/submission owner. Do not start another login or request duplicate credentials. CONS-10 owns `eas.json` and this document; CONS-7 owns `app.json` and dependency/plugin integration. Design's icon, splash, fonts and assets remain unchanged. Widgets do not gate the first TestFlight.

Inspection used Expo `~58.0.25` and screens commit `1d499ce0467433ef6e2e3433694ec5cb7ab33a89`, not an assumed integrated main. That config has root scheme `storytime`, `expo-secure-store` and `expo-notifications`; it has no `ios.bundleIdentifier`, `owner` or `extra.eas.projectId`. The Design/assets composition is still separate. The first distribution source must instead be the Captain-approved coherent charity candidate with the latest agreed web/native fixes and exact merged-main SHA.

## Profiles and intentional omissions

`build.internal-testflight` uses `distribution: store`, not `internal`: EAS internal distribution means ad hoc/enterprise installation, not Apple's internal TestFlight. `ios.simulator: false` produces a physical-device store artifact, unlike the Revyl simulator app. It is not a development client and does not need Metro. Remote build-number management plus `autoIncrement` avoids duplicate iOS build numbers; the coordinator must inspect/init the remote counter for the selected app before the first build, especially if that identifier already has uploads. `requireCommit` keeps build provenance on a clean commit.

The EAS environment is explicitly `preview` to retain this beta's approved sandbox/backend configuration; it does not change the store signing type. Before building, verify that the resolved public Convex URL targets the Captain-approved deployment and that account/project EAS variables do not override it unexpectedly. Never bundle Convex deploy keys, Whop secrets, Apple keys or other server credentials. No OTA channel or update rollout is configured.

`submit.internal-testflight.ios` is intentionally empty and schema-valid. There are no invented bundle IDs, Expo UUIDs, team IDs, Apple app IDs, email addresses, groups or secret-file paths. It is **not ready for unattended submission**. Resolve the choices below, set the real `ascAppId` in this submit profile and have CONS-7 commit the agreed app identity before running remote commands. Do not let an interactive default silently create/select the wrong app or primary language. The profile name does not itself restrict Apple groups or prevent a later public release; the coordinator must select only approved internal groups and never submit for external Beta App Review or production App Review under this authorization.

## Choices the coordinator must resolve

| Choice | Required recorded result and owner |
| --- | --- |
| Expo ownership | CONS-1 verifies the signed-in account, selects the personal account or organization that should own StoryTime, and selects/reuses or creates the intended EAS project after Charles's choice. CONS-7 commits the resulting real `owner` and `extra.eas.projectId`; do not infer ownership from a GitHub login. |
| Root iOS identity | Charles/coordinator approve an available permanent explicit bundle identifier. CONS-7 sets `ios.bundleIdentifier`. Do not ship the simulator-generated `com.anonymous.storytime` as an assumed store identity. Keep the existing `storytime` scheme unless an agreed identity plan changes it. |
| Apple team | CONS-1 verifies the paid membership, selects the correct team/provider and confirms sufficient account roles and accepted agreements. Record the real team ID without passwords or session tokens. All signing assets must belong to this team and the approved bundle ID. |
| App Store Connect record | Select an existing matching iOS app or approve a new one. A new record needs the approved app name, primary language, bundle ID, unique internal SKU and user access. Record its numeric Apple ID as `ascAppId`; it is not the bundle ID or team ID. |
| Signing and submission | Prefer existing suitable distribution certificate, matching App Store provisioning profile and an authorized App Store Connect API key managed securely by EAS. CONS-1 alone may generate/select missing assets after the account choices; never revoke unrelated certificates/keys or commit credentials. Record whether assets are reused or newly created. |
| Internal testers | Confirm which existing App Store Connect users have access and which internal group should receive this build. Internal testing supports up to 100 eligible team users; an arbitrary friend/email outside App Store Connect is external testing and needs separate authorization. Do not invent a group or invite list. |
| Version and compliance | Confirm displayed app/version, the remote build-number starting point and export-compliance answers. SecureStore uses OS encryption and Expo Crypto is present, but do not set a blanket encryption declaration without checking the integrated app. |

## Capabilities and signing inspection

Preserve `expo-notifications`, SecureStore, offline fonts and Design assets in the integrated app. Before remote signing, run `npx expo config --type introspect` locally on the final candidate and inspect the resulting entitlements; this does not require generating/editing an `ios/` folder. EAS synchronizes supported Apple capabilities during a build, so CONS-1 must compare the resolved entitlements with the chosen Apple identifier before allowing that remote change.

For standard remote reminders, expect the notifications plugin, Push Notifications capability, a correctly provisioned APNs environment and an authorized APNs key associated with the chosen team/EAS project. Reuse a suitable key rather than revoking one; APNs keys can serve other apps. Consent, token registration, service receipt and visible physical-iPhone delivery are separate checks. A TestFlight upload, a local toast or a successful simulator test does not prove remote delivery. If APNs setup is unavailable, report that limitation without stripping the existing plugin or pretending delivery passed; the Captain decides the release scope.

The current notification integration also requires the same real UUID in app `extra.eas.projectId` and Convex `EXPO_PROJECT_ID`; dispatch remains off unless the backend owner enables `EXPO_PUSH_ENABLED=true` after provisioning. CONS-1 coordinates that handoff with the backend/notification owners, not by adding server secrets to EAS app variables. Respect the current unavailable/denied states until setup is actually complete; demo fixtures cannot prove real reminder eligibility or delivery.

SecureStore should retain its app-specific Keychain behavior; no cross-app Keychain sharing is needed for the current app. Bundled fonts, WebView tree rendering and web checkout do not require adding App Groups, Apple Pay or widget capabilities. Do not add associated domains, background modes or extensions solely for distribution prep.

### Widgets later

The first TestFlight must remain widget-disabled: no widget plugin/extension target or additional App Group/signing dependency. The widget owner keeps optional SDK 58 `expo-widgets`/file-system work in separate commits. Planned small, medium and accessory-circular widgets use dated timeline snapshots, not a new push entitlement; Expo Go is not their test runtime. Widget images require shared files in the agreed App Group, and any Bricolage/Inter font resources are extension-only additions, not replacements for the main app's fonts.

After the root bundle/team/project are approved, CONS-13/CONS-14 and CONS-7 can propose one extension identifier derived from that root and one App Group shared only by the intended app/extension. Agree their exact names, provisioning and snapshot ownership before registering anything. Widget content must use a minimal versioned real-only snapshot of existing paid/streak query facts, without bearer device IDs, secrets or stored streak counters. Deep links enter the existing guarded root charity flow under the agreed `storytime` scheme; do not introduce bypass routes or a competing scheme. No extension, App Group, entitlement registration or widget authentication is part of this first TestFlight preparation.

## Coordinator execution gates

1. Finish account choices and commit the real identities/profile app ID through the owners above. Verify the charity scene, bundle fruit, direct child-account sandbox payment authority and current native/web renderer fixes on the coherent candidate; do not submit old-shell or fixture-only behavior as connected acceptance.
2. On CONS-1's authenticated machine, inspect the clean exact commit, resolved config, selected EAS project/environment, team, credentials and remote version state. Run the repository's typecheck and lint and the current QA checklist; preserve result evidence separately from preparation.
3. Only after the Captain's go-ahead, run `npx eas-cli@latest build --platform ios --profile internal-testflight`. Use the Bun form instead if the integrated repository has adopted a Bun lockfile. Do not add `--local` or auto-submit during preparation. Record source SHA, EAS build ID, bundle/team, version/build number and the signed `.ipa` outcome; a Revyl simulator `.app` cannot be submitted to TestFlight.
4. Inspect that exact successful build before submission. Then CONS-1 may use `npx eas-cli@latest submit --platform ios --profile internal-testflight --id` followed by the verified EAS build ID, not an unverified `--latest`. Confirm the resolved `ascAppId` and internal group manually; no external/public release is authorized.
5. Wait for Apple's processing and inspect App Store Connect's TestFlight build status, compliance state and group assignment. Internal testing does not require external Beta App Review, but processing/agreement/compliance issues may still block availability. Only claim availability after an eligible internal tester sees/installs that exact build in TestFlight. Record physical-device launch and charity-loop checks separately; builds expire after 90 days.

## Sources checked

Current documentation was read on 2026-11-15: [SDK 58](https://docs.expo.dev/versions/v58.0.0/), [build profiles](https://docs.expo.dev/build/eas-json/), [eas.json reference](https://docs.expo.dev/eas/json/), [version management](https://docs.expo.dev/build-reference/app-versions/), [iOS submission](https://docs.expo.dev/submit/ios/), [TestFlight](https://docs.expo.dev/submit/testflight/), [iOS capabilities](https://docs.expo.dev/build-reference/ios-capabilities/), [push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [Apple app record](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/), and [Apple internal testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/).
