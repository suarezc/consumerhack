# StoryTime

A thoughtful, nearly meditative daily ritual for small groups. Each tree gets one question a day. Members answer, and every answer becomes a blossom on a shared tree that grows through the day. At bloom time the answers unlock for people who answered. Overnight judges group answers by feeling and, after the bloom, show each person three kindred answers from other trees. Built for the Consumer Mobile Hackathon (https://consumermobilehackathon.com): an Expo app on a phone, with Convex as the backend, Revyl for device testing and Whop for payments. The demo is live on a phone tonight, so a reliable, beautiful demo beats breadth.

## Stack

- Expo (SDK 58) with Expo Router and TypeScript. Routes live in `src/app/`; components in `src/components/`. Import from `@/` (maps to `src/`).
- Convex in `convex/`, dev deployment `gallant-warbler-923`. The app reads `EXPO_PUBLIC_CONVEX_URL` from the committed `.env` (a public URL, not a secret).
- Machines have `CONVEX_DEPLOY_KEY` set, so `npx convex dev --once` pushes functions and schema without a login. Server secrets (`WHOP_API_KEY`, `WHOP_ENVIRONMENT`, later `OPENAI_API_KEY`, `WHOP_WEBHOOK_SECRET`) live in Convex environment variables (`npx convex env list` shows names). Never put a secret in the app bundle, an `EXPO_PUBLIC_*` variable or the repo.
- Identity is anonymous: a `deviceId` generated on first launch and stored on the device. No accounts.
- No Xcode or Android SDK on the machines. Builds and device runs go through Revyl.

## DATA (`convex/schema.ts`)

- **trees**: a name, a six-character invite `code`, a host, and an optional `cause` that waterings raise money for.
- **members**: a person (`deviceId`) in a tree, with a display name.
- **days**: one question per tree per day, chosen by a morning cron job, with `bloomAt` and `bloomedAt` once it blooms.
- **answers**: one per member per day, with text, its `blossom` index on the tree, and a `mood` score and `embedding` filled in by the judges.
- **kindred**: for an answer, three matches from other trees, each with a one-line reason.
- **notes**: a private message on someone's answer, drawn on the tree as a fairy light.
- **lanterns**: the SINGLE physical canonical money ledger, exposed as **waterings** in the product/API. There is no second waterings table or combined-ledger sum. A real watering is paid only after signed webhook and sandbox API verification. Optional factual `paidAt` comes from provider `paid_at`; `creditedDate = ritualWindow(paidAt).date`, never checkout `createdAt` or callback arrival. `confirmedAt` records observation of a NEW paid transition only when its provider date is known; an initially undated payment remains non-reactive after backfill. `source: 'demo'` and `demoRunId` identify synthetic fixtures; omitted source on historical rows means real Whop.
- **notificationPreferences / notificationOutbox**: explicit opt-in/permission/token state and a user/date deduplicated dispatch record. Neither holds a streak counter. Bearer identity, push tokens and private notes never appear in other users' projections or provider payload data.
- No streak counters are stored. Convex queries compute answer and giving date sets across ALL memberships for the anonymous device identity. Paid amounts count once per distinct contribution date, not per payment or fifty-cent unit. Real all-time totals preserve historical paid rows even when provider dates are missing; those rows cannot establish a streak or fruit date until verified backfill supplies the facts.
- Migration is additive and idempotent: retain IDs/paid rows/checkout and payment identity, add optional factual fields and indexes, and use a bounded resumable internal provider-backed backfill to fill only missing dates on already-paid matching rows. Never invent a date, promote pending rows in backfill, or count the same provider payment twice. Already-issued reusable checkout links retain their original whole-cent verification semantics and metadata marker.
- Clock contract: a day is **06:00 UTC through the next 06:00 UTC**, bloom normally at 21:00 UTC. It is not calendar midnight or device-local midnight. Answers, paid credit, Grove, streaks and notification deduplication share this ritual boundary. Queries return server `{date,opensAt,nextBoundaryAt,now}`; Today and streak summary depend on the next real-day insertion so morning rollover invalidates subscriptions.

## Rules

1. Each tree gets one question a day.
2. Each member gives one answer, and the tree grows a blossom for it.
3. The tree blooms when everyone has answered or at `bloomAt`, whichever comes first.
4. You can read answers only if you answered. Enforce this in Convex queries, not in the UI.
5. After the bloom, you see three kindred answers from other trees, each with one line on what you share.
6. Notes and reactions are visible only to the author of the answer they're on (and the sender).
7. Past days form the grove; a missed day is a bare sapling.
8. A demo switch runs a whole day in about a minute: it compresses the clock for a tree, seeds sample answers and triggers the bloom and the judges on cue. It must work reliably on stage.
9. New waterings have a $1 minimum, then $0.50 increments, capped at $100 (integer cents 100..10000, divisible by 50). A standalone $0.50 checkout is unsupported on the existing Whop path. Never silently change a selected charge or credit unpaid money. Only confirmed paid waterings create real fruit or trigger a real watering reaction.
10. Answer streak: the number of consecutive days, ending today or yesterday, on which the user answered.
11. Giving streak: the number of consecutive days, ending today or yesterday, on which the user has at least one paid watering. Any valid paid amount counts. Several waterings in one day count once.
12. A streak that includes yesterday but not yet today is shown as "at risk", not broken. It breaks only when a full ritual day passes with nothing.
13. At giving streaks of exactly 3, 7 and 30 days, THAT contribution date's fruit from the user is drawn golden on the shared tree and in their Grove. Compute the streak ending that historical date; never recolor past fruit from the user's current streak.

## SCREENS

1. Join or create a tree by code.
2. Today: the tree, the question and your answer. Under the question show both computed streaks, each a small icon and number: blossom for answers, fruit for giving, with the at-risk state.
3. Bloom: tap blossoms to read, leave a note or water the tree. After a confirmed paid watering, briefly show the new giving streak ("4 days of giving"). The tree reacts to the new canonical paid fruit ID, never checkout close/return; baseline initial subscription hydration/reload and consume each event once.
4. Kindred.
5. Grove: past trees where the viewer gave show their own fruit, with golden flags computed for each historical date. Show the longest giving streak and the user's total given. Active demo history and totals are clearly synthetic and isolated from real-account totals.

`streaks.summary` and Today return `{clock,answer:{count,status},giving:{count,status,longest,totalCents},currency:'USD',isDemo,undatedPaidCount}`; status is `current|at_risk|none`. Fruit projections expose opaque canonical row ID/date/golden/milestone/isMine/source/paidAt, never provider IDs or bearer identity. Grove retains its day-array shape with viewer-only `fruits`. `waterings.checkout` aliases `lanterns.checkout`; both use the same ledger.

## NOTIFICATIONS

- After a real bloom, if the user's giving streak is at risk, send one opt-in notification: **"Today's tree has bloomed. Water it to keep your N-day streak."** At most one per user/ritual date across all trees, and none if the user has no streak or has already given today.
- Respect explicit opt-in and granted OS permission; do not prompt automatically, invent tokens, or call a toast a delivered notification. The atomic bloom hook queues/deduplicates. Recheck the real-only computed giving streak, source bloom, membership, current ritual date and latest preference/token state immediately before dispatch.
- Persist a dispatch claim before external sending. Unknown acceptance is terminal; never retry it. Only a known explicit provider rejection may be bounded-retried after full recheck. Provider acceptance and receipt handoff are not proof of OS display; a payment committed after the dispatch claim cannot atomically cancel an accepted external alert. Demo fixtures never send real notifications.
- Real remote push needs a push-enabled native build, genuine project/APNs/FCM provisioning and permission on a supported physical device. Revyl simulator UX/testing alone is not proof of remote notification delivery.

## DEMO MODE

- Restart seeds the active demo user with answers and explicitly synthetic paid watering fixtures for the previous three ritual dates, so both streaks start at 3, at risk. Today's answer makes the answer streak 4; the next confirmed or explicit synthetic demo watering makes the giving streak 4.
- Every fixture/history day is tagged with the active run ID. Checkout captures its originating run identity before the external provider call, never whichever run is current when that call returns. Stop/restart hides old fixtures and stale callbacks cannot affect a new run. Synthetic ledger rows have `source:'demo'`, no provider payment ID, and are excluded from real giving/raised totals and notification eligibility.
- `waterings.demoWater` is a clearly labelled synthetic demo interaction, available after participation and bloom, idempotent once per user/run and guarded by the submitted run ID. It is not Whop-confirmed money. Real sandbox checkout remains genuine and webhook-authoritative; real payment rows survive stop/reset and count in real totals even when a callback arrives after its original demo run ended, but cannot react in a newer demo run.
- An active demo pins its displayed ritual date to the run's start date while its one-minute growth clock drives the current tree. It does not change the real server's 06:00 UTC question/streak policy.

## The tree

`design/tree.html` is the reference: the canvas tree, palette by time of day, blossoms, fairy-light notes and the answer-landing animation. The app renders it through `src/components/Tree.tsx`, whose props are the contract between the data and the visuals:

- `timeOfDay` 0..1 (0 = 6:00, 1 = 21:00), `answers` (blossom count), `mine` (blossom indices that are the viewer's), `notes` (strands between two blossoms with a light count), `lanterns` (count), `onTapBlossom(index)`.
- The agreed additive watering contract preserves those props and adds optional `fruits?: readonly { id: string; golden: boolean; mine?: boolean }[]` and `wateringEvent?: { id: string; fruitId: string; revision: number } | null`. Map the backend's opaque `fruitId` to `id` and `isMine` to `mine`; never send provider payment IDs or bearer identity to the renderer. `wateringEvent` represents a newly confirmed paid event, with `revision` as a payload version rather than a stored streak/event counter. Baseline hydration/reload and consume each event once; fruit backfill or checkout return alone must not trigger a success reaction.
- Design owns implementing and verifying these optional renderer inputs and their fruit/watering motion. Recording the agreed contract here does not claim that renderer support has shipped.

Change the props only with both sides agreeing. Visual identity: Newsreader (voice) and IBM Plex Mono (meta), the colours in `design/tree.html`, and one visual world set by the time of day rather than system light/dark mode.

## Whop waterings (legacy physical lanterns ledger)

The cause-tree framing: waterings raise money for a cause the tree picks, shown as a running total. Use web checkout, not Whop's native SDK (it has no sandbox and is Swift-only). A Convex action creates the checkout with `@whop/sdk`, the app opens it with `expo-web-browser`, and Whop's `payment.succeeded` webhook hits the Convex HTTP route `/whop`. Preserve raw-body official signature validation, sandbox API payment retrieval, exact USD subtotal/tax/total and metadata bindings. Deduplicate globally by provider payment ID; reusable checkout IDs are one-to-many. Real fruit lights only from the paid ledger record. `WHOP_ENVIRONMENT` must be `sandbox`; the test card is 4242 4242 4242 4242. Existing $1 browser/webhook/replay proof is not proof of $0.50 support or phone checkout.

## HOW TO WORK

- Data and server logic (`convex/`): the Build crew. The assigned core owner alone writes schema, crons and lifecycle integration; announce API/schema contracts early and route notification schema/hook requests through the Build Captain.
- The tree and the visual system (`src/components/Tree.tsx`, theme, fonts, motion): the Design crew.
- Screens (`src/app/`): Build wires data; Design styles. Keep PRs small and merge often to avoid conflicts.
- Write Convex tests for rules 10–12 including at-risk yesterday continuity, a full empty day, two waterings on one day and cross-membership date deduplication. Also cover calendar midnight versus 06:00 UTC rollover, pending/failed/replayed payments, provider paidAt versus checkout creation, historical 3/7/30 golden dates, privacy and demo reset/isolation.
- Preserve merged core/Whop/judges. Use fresh branches against main, never closed PR branches. Coordinate every shared Convex deploy AND codegen through the Captain: codegen stages remote analysis/schema even though it does not activate code. Never deploy an incomplete parallel checkout over another owner's functions. Get an independent exact-head review, run the checks below, and distinguish provider/device evidence from simulated tests. Never merge without explicit approval for that PR.

## Checks

Before declaring work done: `npx tsc --noEmit`, `npx expo lint`, and `npx convex dev --once` when `convex/` changed (it typechecks and pushes the functions).

This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
