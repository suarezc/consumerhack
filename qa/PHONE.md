# Cloud iPhone verification

## Build and identify

Use an exact, clean, merged `main` commit for the final demo. Record `git rev-parse HEAD`, the Revyl build/version IDs, the phone model/OS, and whether installation preserved app data. A preliminary feature-branch build is not the final integrated demo build.

The `preview` profile produces an arm64 iOS Simulator Release app with its JavaScript bundled and keeps Xcode's default simulator signing enabled. Disabling signing is a candidate cause of native Keychain failures; confirm identity loading on the installed artifact rather than treating build success as proof. It needs neither Metro nor Expo account credentials. Run all native commands on Revyl's cloud runner, not on the Linux workspace:

```sh
revyl auth status
revyl config validate
revyl build --profile preview --platform ios --remote
```

The configured app UUID identifies the StoryTime iOS app used by the cloud-build integration. If connected validation cannot access it, stop and resolve the workspace/app association rather than creating a duplicate or changing credentials in source. Credentials remain outside the repository. The committed `.env` contains only the public Convex URL.

When using the platform cloud-build tool instead of the CLI, archive the application directory and pass the same setup/build commands and output path from `.revyl/config.yaml`. Record the exact source SHA separately because a successful archive build alone does not prove its provenance.

CLI connected validation is a separate pending item, not a blocker to the already-working platform cloud-build/device route. Do not repeat login prompts until the person explicitly says they are ready. Keep phones released until an integrated build is ready to install.

## Preliminary shell

- Confirm the join/create screen launches without an identity-recovery error or a development-server prompt.
- Switch join/create modes and exercise text inputs. At the shell checkpoint, both submissions must remain disabled and the unavailable-service message must remain explicit.
- Open `storytime://today`, `storytime://bloom`, `storytime://kindred`, and `storytime://grove` without a selected tree. Each must return to the entry screen rather than disclose content.
- Terminate and relaunch the app within the same phone session. Confirm it still opens successfully. This alone does **not** prove that the exact device ID persisted: the shell does not expose identity or allow a tree to be selected. Record persistence as unverified until an observable tree/session survives restart or an authorized native storage inspection compares the ID.
- Do not treat a fresh Revyl session as a persistence test; session replacement discards app data.

## Final-build readiness

The approved watering/streak pivot supersedes the old lantern-era behavior. Earlier shell and $1 backend/browser payment evidence is useful plumbing coverage, not acceptance of this pivot. Before the final build, obtain the Captain's identified integrated merged-main SHA and confirm these dependencies:

- The sole backend owner has integrated one authoritative payment ledger, computed user-level answer/giving streaks across memberships, actual provider-paid-date attribution, integer 50-cent amounts, historical golden milestones and isolated three-prior-day demo history. Obtain the explicit timezone/credited-day boundary contract before date-edge assertions; do not silently assume midnight or change the existing ritual clock.
- Screens have integrated create/join, membership restoration, reactive paid fruit/totals, streaks, Grove, checkout return and permission-respecting notifications. No app identity/session changes may be added just to make QA easier.
- Design's latest merged renderer/presentation includes the original time-only growth, current bridge lifecycle, paid fruit, historical golden 3/7/30 states and flourish. Record the exact reviewed head contained in main rather than assuming an earlier native harness covers it.
- The notification owner has documented actual device/service capability, permission behavior, at-risk scheduling and payment-before-send suppression. Delivery evidence must distinguish scheduling, service acceptance and visible OS delivery.
- The Captain has confirmed the integrated backend deployment and sandbox webhook configuration. QA never deploys a partial checkout or asks for a previously configured secret again.

## Integrated ritual

Use at least three distinct identities and two trees. Give each test its actions, observed result, evidence, and pass/fail/untested status. A visible UI restriction does not establish server-side privacy: also exercise the underlying query with an ineligible identity.

The final integrated binary must include the latest merged Tree bridge revision, including its hello/BFCache lifecycle updates. Older native harness evidence does not cover later bridge changes. Verify a reference-faithful, full-bleed scene rather than a padded or scrimmed wrapper, blossom taps opening the right answer card, and card dismissal. Compare dawn, midday and night with the answer count held constant to verify original time-only geometry growth, then run full-day playback/replay and inspect native motion/lag. Record measurement conditions and visible stalls honestly; do not call a browser timing sample native performance. Screens must key the Tree instance by `treeId:dayId`; exercise a same-count/same-time day switch and demo replay to catch stale selection or bridge state. Visual bloom is clock-driven between `timeOfDay` 0.79 and 0.95; backend access checks remain authoritative, including early everyone-answered bloom.

| Area | Required observations |
| --- | --- |
| Membership | Create one tree, join it by its six-character code from a second identity, reject invalid codes, and restore the same membership/selected tree after app termination/relaunch within one phone session. Never display or log the bearer device ID; membership continuity or a non-secret derived assertion is enough. |
| Answers | Submit once, observe one new blossom, reject a second submission, and preserve the first answer. |
| Participation and bloom privacy | Before answering and before bloom, query with eligible/ineligible identities. Never disclose another person's answer until both participation and bloom gates permit it. |
| Bloom timing | Verify both everyone-answered bloom and deadline bloom; confirm answers become readable only at the permitted point. |
| Notes | Send a private note. Only sender and answer author may read it; a third identity must not see the note through UI or query. |
| Grove | Show a past answered day and a missed day as a bare sapling. |
| Kindred | After bloom, show three answers from other trees with one-line reasons; do not accept same-tree matches. Record stub versus model judging. |
| Demo replay | Run a complete compressed day in about one minute, restart it, and prove old scheduled jobs cannot bloom or judge the new run. |
| Answer streak | Verify today activity, yesterday-only at-risk continuity and a complete credited-day gap/reset against the agreed clock. Answer on multiple trees on the same credited day and confirm it counts once for the user, without stored counters. |
| Giving streak | Verify the same today/yesterday/gap cases using only verified paid facts. Multiple distinct paid transactions on one date add their legitimate monetary amounts but count as one streak day. Check provider paid time versus checkout creation and delayed webhook arrival across the agreed day boundary. |
| Historical golden fruit | Verify contribution dates that reach 3, 7 and 30 receive golden fruit on both the shared tree and Grove. Later streak growth or a later gap must not retroactively change a historical day's milestone. Pending/cancelled checkout and another user's streak must not produce the viewer's paid milestone. |
| Sandbox watering | From the native app, open checkout through expo-web-browser, cancel and return with no paid fruit, amount or streak change. Submit an actual sandbox $0.50 checkout if the provider supports it, then return and observe reactive fruit/totals only after verified payment. If the provider rejects $0.50, capture the concrete failure and report the blocker; do not silently substitute $1 and call the 50-cent case passed. Verify accepted values use integer 50-cent increments and invalid increments fail. Browser return alone must never mark paid. |
| Paid replay and dates | Replay the genuine signed payment delivery: ledger amount, fruit and giving day remain unchanged. A second real payment on that date may increase paid amount once but must not extend the day's streak again. Pending records and cancelled browser sessions are not paid facts. |
| Three-day demo history | Start with three explicitly synthetic prior answer/giving days; today's demo activity advances 3 to 4. Inspect shared tree and Grove milestones. Synthetic money is scoped to the active demo, excluded from real totals outside that scope, and cannot leak through demo exit, restart, stale jobs or replay. |
| At-risk notifications | Test opted-in at-risk post-bloom scheduling, today activity removing risk, and payment before notification evaluation/send suppressing the giving reminder. Exercise a denied permission path without repeated prompts or fake delivery. Record scheduling/attempt/service receipt separately from visible OS notification delivery; a toast is not a delivered notification. If the simulator or service cannot deliver, mark device delivery untested with the precise limit instead of passing it. |

Stop and route failures to the owning crew through the Captain; QA does not repair shared app, package, design, or backend files. Preserve screenshots or recordings with the build/device/SHA and describe outcomes in plain English. Leave unimplemented or blocked flows explicitly untested.
