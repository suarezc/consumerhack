# StoryTime

A daily charity-tree ritual: open directly into yesterday's S.A.C.K. tree → today's charity-related question → answer and grow one response fruit → water the shared tree to add fireflies and fairy lights → a computed giving streak. No plant/join, name, tree-name or invite-code form gates first launch. Build for a reliable, beautiful phone experience at the Consumer Mobile Hackathon (https://consumermobilehackathon.com). Preserve Kindred and private notes without expanding them.

## Shipped release and hackathon scope

- The release source is `capy/testflight-widgets`, pinned at `03ffb4cc7085a7b326be4019d18c75dd0287c282` for this landing. Branch from the requested release pin for changes; only coordinator CONS-1 pushes to the release branch, runs EAS/TestFlight and deploys Convex. Open the requested pull request; never merge without Charles's explicit approval.
- Prioritize direct work needed for the playable hackathon app. Do not initiate additional audits, hardening, privacy work, retry-safety work or review ceremony. Preserve existing fixes and contracts.
- Visible app and widget UI must not contain “demo”, “sample” or “sandbox” labels or disclaimers. Internal source names, ledger tags and provider configuration remain unchanged; this copy rule does not change payment facts or authorize claims that funds reached the charity.
- The response-fruit backend is already live on `gallant-warbler-923`. This landing needs no Convex deployment or codegen. Run only TypeScript and Expo lint for the landing task.

## Stack and identity

- Expo SDK 58, Expo Router and TypeScript. Routes live in `src/app/`, components in `src/components/`, and `@/` maps to `src/`. No local Xcode or Android SDK; use Revyl for native builds/device runs.
- Convex functions live in `convex/`, shared development deployment `gallant-warbler-923`. The committed `EXPO_PUBLIC_CONVEX_URL` is public, not a secret. Machines have `CONVEX_DEPLOY_KEY`; deployment and codegen both require an exclusive slot from the Build Captain. Codegen stages remote state even without activation.
- Server-only secrets include `WHOP_API_KEY`, parent `WHOP_WEBHOOK_SECRET`, child `WHOP_CHILD_WEBHOOK_SECRET`, and optional judge/push credentials. Never place secrets in the repository, app bundle, logs or `EXPO_PUBLIC_*` variables.
- Anonymous `deviceId` is a device-stored bearer, not a public identity. `users._id` is the stable opaque person ID across memberships and provider metadata. Backfill missing member identities transactionally; do not expose device IDs or push tokens.

## Daily charity and questions

- Store each day's charity name, theme, description, link and programs. Seed **S.A.C.K. (Simple Acts of Care and Kindness)** every day for now, themed **Youth mental health and kindness**. Link: https://simpleacts.org/. Description: “Building safer, kinder communities where children feel supported, connected and valued.”
- Seed Charles's requested programs: “A kindness anthology for K–12 students”, “Parent talks”, “Scholarships”, and “After-school programmes”. These are the requested seed, not a claim that every program has independently been verified on the website.
- The catalog has at least 20 kindness/mental-health questions (currently 24). Each tree persists its cursor and used indices in the same transaction that inserts a day. Retries/concurrent creation must neither skip entries nor repeat before exhaustion. Initialize a legacy cycle from existing real-day catalog questions; preserve existing daily questions.
- One authoritative ritual day runs **06:00 UTC to the next 06:00 UTC**. Normal bloom is 21:00 UTC or when everyone answers, whichever comes first. Calendar midnight and device-local midnight are not rollover.
- Morning closes expired real days into public gross raised cents, distinct answerer count and distinct waterer count, and ensures the current day. Closure is idempotent; verified late settlement recomputes the original closed impact. No stored streak counters.
- Today displays charity, its daily paid total and the exact CTA **“Water today's tree for S.A.C.K.”**. Legacy `raisedCents`/`lanternCount` aliases remain real tree-wide values; the charity UI uses `totalRaisedCents`.

## Data and money contract

- `trees` hold invite codes, host, optional legacy cause text, question-cycle state and active demo day. `members` associate a person with a tree. `days` hold question, charity/cause, ritual window, bloom and optional closed impact. `answers` retain one answer/member/day, blossom and judge facts. `kindred` and private `notes` retain their existing contracts.
- `causes` hold charity metadata and the verified sandbox child recipient. `users` provide opaque person identity. `impactViews` record first-open acknowledgement by user/tree/current-day ID.
- **`lanterns` is the single physical money ledger**, exposed as waterings in the product/API. Never create a parallel waterings ledger or sum two ledgers. Canonical intents/paid records contain `userId`, `dayId`, `bundles`, integer `amountCents`, status and provider checkout/payment identity, plus immutable recipient, fee and attribution facts. Convert cents to dollars only at the SDK boundary.
- Offer exactly **2/5/10 bundles for $1/$2.50/$5**; one bundle is $0.50. New checkout and explicit synthetic watering require the caller's answer on the current selected day **before or after bloom**. Enforce server-side; the old public checkout alias cannot bypass authorization or presets.
- Persist a pending canonical intent **before** provider I/O. Capture target day/run, user, answer, bundles, amount, expected recipient and zero application fee. Attach the returned checkout ID to that same intent even if time, cause or active demo changes during I/O.
- New attribution is `checkout_day`: the captured target day supplies `creditedDate`; actual optional `paidAt` comes only from verified provider `paid_at`. A payment that settles tomorrow still belongs to its authorized original day, including closed impact. Legacy `provider_day` attribution derives its date only from verified provider time. Never invent dates from checkout creation or callback arrival.
- Additive migration preserves existing ledger IDs, paid amounts and provider identities. A bounded resumable internal backfill verifies already-paid rows and fills only missing facts; it must not promote pending rows, duplicate money, retarget a canonical intent or fabricate a reaction. Integral legacy multiples of 50 cents can infer bundle equivalents (including nonpreset 3 bundles); nondivisible paid amounts retain their money with unknown light allocation.
- Existing legacy checkout links retain original metadata/whole-cent verification semantics; verified legacy contributions are capped at $100, hence at most 200 inferred giving-light units per payment. Reusable checkout links can produce distinct payment rows, globally deduplicated by provider payment ID, without inheriting an earlier payment's date.

## Payment authority and direct-charge sandbox

- `WHOP_ENVIRONMENT=sandbox` is mandatory. Use `@whop/sdk` and an inline one-time USD price with exact server-derived bundle amount, opaque user/day/bundle metadata and durable intent idempotency. The app opens the returned URL through `expo-web-browser`; browser close/return never marks money paid.
- New payments are direct charges to the configured cause's verified child account, captured on the intent as `expectedRecipientAccountId`. Zero application fee means omit the SDK fee field. No automatic fee fallback or silent parent-account fallback. Missing recipient or child signing-secret configuration fails closed.
- The installed S.A.C.K. **example** sandbox child proves neither charity ownership nor KYC/payout readiness. Do not create another account, request onboarding or send owner/customer email without explicit approval. Internal verified lookup/setup may reuse the existing child. There is no public arbitrary account setter.
- Parent `POST /whop` retains legacy parent coverage and its own secret. Child-only `POST /whop/children` uses a separate secret/subscription because `child_resource_events:true` excludes parent events. Never replace the parent subscription with the child-only one.
- Both routes validate the exact raw body using official SDK signatures, timestamp and webhook identity, then retrieve actual sandbox payment facts. Check route scope, immutable recipient, paid status, USD subtotal/tax/total, checkout identity and all captured user/day/bundle/answer bindings. Metadata or a signature alone does not prove a valid paid contribution. Deduplicate atomically by payment ID and preserve replay safeguards.
- Gross raised cents are not net charity proceeds. Never claim actual donations reached S.A.C.K. Test card: 4242 4242 4242 4242. A checkout configuration, parent payment, simulated webhook or browser test is not genuine child-payment or phone-checkout proof.

## Response fruit, giving lights and streaks

- Every answer row produces exactly one stable response fruit `response:${answerId}`. Today and Yesterday show the shared day's response fruits; Grove shows only the viewer's response fruit. Before participation and bloom, fruit DTOs reveal only opaque response identity and whether it is mine, never text, author/member/user/provider identity or private notes.
- Response DTOs are `{fruitId,isMine,golden:false}`; the always-false field preserves compile-safe renderer mapping, not a giving milestone. Answers grow fruit without payment. Payment must never add or recolor response fruit.
- Derive `lightBundles` from paid bundle equivalents in the single lanterns ledger, scoped to the selected day/run. Watering2/5/10 adds exactly2/5/10 giving-light units for fireflies/fairy lights, not fruit. Pending rows add no lights. Never silently truncate money or light counts.
- Golden giving milestones remain computed for historical contribution dates at exactly3/7/30, never attached to response fruit. Derive `goldenLightBundles` as the historical3/7/30 giving-milestone subset of `lightBundles`, across the contributor's memberships; default0 and never recolor response fruit. Backend fields do not establish renderer/native acceptance.
- Compute answer/giving sets across all the user's memberships. Several payments/bundles on one date count once toward a giving streak. End today = current; end yesterday = at risk; a complete empty ritual day breaks the run. Preserve undated paid money in all-time giving without inventing unknown dates.
- A newly confirmed payment exposes `lightEvent:{id,lightBundles,revision:2}`, using the stable canonical paid row ID and its bundle quantity, never response fruit IDs. New canonical events have at most10light units; already-issued legacy payments can have up to200. `confirmedAt` still means a new dated paid observation, never factual backfill. Initial hydration/reload, replay and browser return must not replay success feedback; the client baselines/consumes event identity.
- `streaks.summary` and Today retain server clock, `answer:{count,status}`, `giving:{count,status,longest,totalCents}`, `currency:'USD'`, `isDemo`, `undatedPaidCount`. Yesterday/firstOpen retain all public/private impact and acknowledgement semantics; Yesterday and Grove return `lightEvent:null` so historical light counts never emit new payment feedback.
- No ledger migration, stored counter, price/recipient/payment-authority change or provider reconfiguration is needed for this visual-semantic projection change. Prior genuine payment/replay proofs remain money evidence, not response-fruit or giving-light visual acceptance.

## Entry, yesterday and answer reading

1. A fresh device stores its anonymous identity, automatically opens a S.A.C.K. tree and starts the seeded experience using the existing tree/day APIs. Existing selected trees and memberships are reused. Create/join forms remain secondary, reached through tree settings rather than first launch.
2. First open each ritual day shows yesterday's completed tree, response fruit, giving lights, charity/programs and **“N people answered, M watered, $X raised for S.A.C.K.”**; show **“You gave $Y”** privately when applicable, then a button to today's question.
3. Today shows the charity, question, daily paid total, answer, shared response-fruit tree, paid giving lights and giving streak. Allow watering after the caller answers without requiring bloom.
4. Tapping the tree opens an available answer; the answer-count detail also cycles through answers. Answer reading retains the participation-and-bloom gate. The seeded tree blooms when the viewer answers. Private notes and Kindred remain secondary. Past days form the Grove, with a missed day a bare sapling.
- `days.yesterday` returns day/date, tree identity/name, charity, public counts/total, only the viewer's `myGivenCents`, fruits, demo flag and closedAt. No answer text, other people's individual amounts, bearer or provider identities.
- `days.firstOpen` returns `{clock,todayDayId,shouldShowYesterday,yesterday}|null`. Queries never consume the intro. `days.acknowledgeYesterday({deviceId,treeId,dayId:todayDayId})` is transactional/idempotent per user/tree/day and rejects stale selected days. A new real day or demo run resets the intro.
- Reading answer text still requires participation **and bloom**, enforced in Convex queries, independently of pre-bloom watering eligibility. Notes/reactions remain visible only to sender and answer author.

## Seeded ten-minute day

- The seeded day has a ten-minute answer window and schedules the existing three answers. Its tree visibly grows over the first minute; the viewer's answer completes bloom and opens answer reading. Exactly three prior personal dates contain answers and explicit synthetic giving, so both streaks start at 3/at-risk; today's answer and next watering become 4.
- Completed yesterday has exactly 40 answerers and 12 distinct synthetic waterers including the host, each with two bundles: $12 gross/40 response fruits/24 giving-light units, viewer $1/one response fruit/two giving-light units. Only the two earlier personal dates are additionally seeded; no duplicate yesterday/fourth prior date.
- History-only sample members do not inflate current quorum. Current response fruit starts at zero and grows one per answer. Giving lights start at zero and add2/5/10 per watering interaction; multiple interactions are allowed with distinct validated request IDs. Retrying the same run/user/request is idempotent and changing its bundle count fails. Internal sample/demo state must not produce visible labels or disclaimers.
- Synthetic rows are explicitly `source:'demo'`, tagged with run ID and have no provider payment ID. Active run data never enters real totals, real streaks or notification eligibility. Stop/restart hides old fixtures/events; stale answers, requests and scheduled seeds cannot mutate the new run.
- Genuine sandbox payments remain real provider records even when originated during a demo. Immutable original day/run attribution survives provider latency and reset without reacting in a newer run.

## Mounted peach giving widgets

- Original colorful peach artwork from `design/streak-fruit.html` is the widget reference, not a firefly replacement. The personal fruit represents the giving streak independently of shared-tree response fruit. Preserve healthy, thirsty, withered/new-bud and never-watered blossom states, green/blush/ripe/gold milestones at1/3/7/30, and Bricolage/Inter typography for small, medium and circular sizes.
- `RitualProvider` mounts `createNativeWidgetSync` through `createWidgetSessionBridge`. Publication uses the selected day's scalar giving summary, clock, totals and answer count, including the seeded giving streak; it never reads `Today.fruits` or derives giving from response fruit.
- `./plugins/withStoryTimeWidgets.cjs` is enabled. The extension bundle is `com.charlessuarez.storytime.widgets`, AppGroup is `group.com.charlessuarez.storytime.widgets`, and target is `ExpoWidgetsTarget`. Preserve existing clear/generation behavior and the `storytime://` root link.
- Remote notifications remain disabled through the SDK58 plugin option `enableRemoteNotifications:false`. Preserve App Store Connect app ID `6835243364`, the existing Expo project identity and the coordinator's signing/store configuration.

## Notifications

- At most one opt-in reminder per user/ritual date across trees, after a real bloom when giving is at risk: **“Today's tree has bloomed. Water it to keep your N-day streak.”** None without a streak, after giving today or for synthetic demo activity.
- `notificationPreferences` stores consent/permission/token state; `notificationOutbox` stores deduplicated dispatch facts, never streak counters. Recheck real giving, current date, membership, current bloomed source and current preferences immediately before a persisted dispatch claim.
- Late real settlement or safe backfill that discovers current risk re-evaluates only the payer's **current real bloomed membership days**, not the historical target day. Never reopen accepted, handed-off or unknown rows.
- Unknown external acceptance is terminal. Only known explicit rejection may be bounded-retried after recheck. Payment after an accepted external dispatch cannot atomically cancel that alert. Provider acceptance/receipt is not proof of OS display.
- Keep push disabled until genuine project/APNs/FCM provisioning and a supported physical-device test. Revyl simulator UX or an in-app toast is not remote iPhone notification proof.

## The tree and ownership

- `design/tree.html` remains the visual reference: time-of-day world, canvas tree, blossoms, fairy-light notes and answer landing. Newsreader is voice; IBM Plex Mono is metadata. Preserve the palette instead of using system light/dark mode.
- Existing Tree props remain `timeOfDay` 0..1 (06:00–21:00), `answers`, `mine`, `notes`, `lanterns`, `onTapBlossom(index)`. The revised agreed backend-to-renderer contract is `fruits?:readonly {id:string;golden:false;mine?:boolean}[]` and `lightBundles?:number`, `goldenLightBundles?:number`, and `lightEvent?:{id:string;lightBundles:number;revision:number}|null`. Map backend fruitId/isMine to renderer id/mine. Change props only with both sides agreeing.
- Design owns Tree, theme, fonts and motion; Build owns data/server and screen wiring, Design styles screens. One core owner owns schema/crons/payment lifecycle. Announce shared contracts through Captains; do not overwrite the preview debugger's bridge/bundle or Design rendering.
- Actual public embedded/sandboxed preview growth and final native fruit behavior require their own QA; backend tests or top-level Chromium are not visual acceptance.
- Keep requested PR scope, never push closed/merged branches, and never merge without explicit approval for that PR. Do not push to the coordinator's release branch or initiate extra review work. Clearly separate source checks, actual provider, native and physical-device evidence.

## Checks

For this landing, run `npx tsc --noEmit` and `npx expo lint` only. Do not run tests, extra audits, Convex deploys or codegen. Deployment remains the coordinator's responsibility and requires an explicit instruction.

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
