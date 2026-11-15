# StoryTime

A thoughtful, nearly meditative daily ritual for small groups. Each tree gets one question a day. Members answer, and every answer becomes a blossom on a shared tree that grows through the day. At bloom time the answers unlock for people who answered. Overnight judges group answers by feeling and, after the bloom, show each person three kindred answers from other trees. Built for the Consumer Mobile Hackathon (https://consumermobilehackathon.com): an Expo app on a phone, with Convex as the backend, Revyl for device testing and Whop for payments. The demo is live on a phone tonight, so a reliable, beautiful demo beats breadth.

## Stack

- Expo (SDK 58) with Expo Router and TypeScript. Routes live in `src/app/`; components in `src/components/`. Import from `@/` (maps to `src/`).
- Convex in `convex/`, dev deployment `gallant-warbler-923`. The app reads `EXPO_PUBLIC_CONVEX_URL` from the committed `.env` (a public URL, not a secret).
- Machines have `CONVEX_DEPLOY_KEY` set, so `npx convex dev --once` pushes functions and schema without a login. Server secrets (`WHOP_API_KEY`, `WHOP_ENVIRONMENT`, later `OPENAI_API_KEY`, `WHOP_WEBHOOK_SECRET`) live in Convex environment variables (`npx convex env list` shows names). Never put a secret in the app bundle, an `EXPO_PUBLIC_*` variable or the repo.
- Identity is anonymous: a `deviceId` generated on first launch and stored on the device. No accounts.
- No Xcode or Android SDK on the machines. Builds and device runs go through Revyl.

## Objects (`convex/schema.ts`)

- **trees**: a name, a six-character invite `code`, a host, and an optional `cause` that lanterns raise money for.
- **members**: a person (`deviceId`) in a tree, with a display name.
- **days**: one question per tree per day, chosen by a morning cron job, with `bloomAt` and `bloomedAt` once it blooms.
- **answers**: one per member per day, with text, its `blossom` index on the tree, and a `mood` score and `embedding` filled in by the judges.
- **kindred**: for an answer, three matches from other trees, each with a one-line reason.
- **notes**: a private message on someone's answer, drawn on the tree as a fairy light.
- **lanterns**: a Whop payment hung on a tree or an answer; the only money object. A lantern is `paid` only when the Whop webhook says so.

## Rules

1. Each tree gets one question a day.
2. Each member gives one answer, and the tree grows a blossom for it.
3. The tree blooms when everyone has answered or at `bloomAt`, whichever comes first.
4. You can read answers only if you answered. Enforce this in Convex queries, not in the UI.
5. After the bloom, you see three kindred answers from other trees, each with one line on what you share.
6. Notes and reactions are visible only to the author of the answer they're on (and the sender).
7. Past days form the grove; a missed day is a bare sapling.
8. A demo switch runs a whole day in about a minute: it compresses the clock for a tree, seeds sample answers and triggers the bloom and the judges on cue. It must work reliably on stage.

## Screens

1. Join or create a tree by code.
2. Today: the tree, the question and your answer.
3. Bloom: tap blossoms to read, leave a note or hang a lantern.
4. Kindred.
5. Grove.

## The tree

`design/tree.html` is the reference: the canvas tree, palette by time of day, blossoms, fairy-light notes and the answer-landing animation. The app renders it through `src/components/Tree.tsx`, whose props are the contract between the data and the visuals:

- `timeOfDay` 0..1 (0 = 6:00, 1 = 21:00), `answers` (blossom count), `mine` (blossom indices that are the viewer's), `notes` (strands between two blossoms with a light count), `lanterns` (count), `onTapBlossom(index)`.

Change the props only with both sides agreeing. Visual identity: Newsreader (voice) and IBM Plex Mono (meta), the colours in `design/tree.html`, and one visual world set by the time of day rather than system light/dark mode.

## Whop lanterns

The cause-tree framing: lanterns raise money for a cause the tree picks, shown as a running total. Use web checkout, not Whop's native SDK (it has no sandbox and is Swift-only). A Convex action creates the checkout with `@whop/sdk`, the app opens it with `expo-web-browser`, and Whop's `payment.succeeded` webhook hits the Convex HTTP route `/whop`, which marks the lantern paid. Light a lantern from the webhook record, never when the browser closes. `WHOP_ENVIRONMENT` must be `sandbox`; the test card is 4242 4242 4242 4242.

## Ownership

- Data and server logic (`convex/`): the Build crew. The schema is the shared contract; announce changes to it.
- The tree and the visual system (`src/components/Tree.tsx`, theme, fonts, motion): the Design crew.
- Screens (`src/app/`): Build wires data; Design styles. Keep PRs small and merge often to avoid conflicts.

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
