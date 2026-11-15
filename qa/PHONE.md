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

## Preliminary shell

- Confirm the join/create screen launches without an identity-recovery error or a development-server prompt.
- Switch join/create modes and exercise text inputs. At the shell checkpoint, both submissions must remain disabled and the unavailable-service message must remain explicit.
- Open `storytime://today`, `storytime://bloom`, `storytime://kindred`, and `storytime://grove` without a selected tree. Each must return to the entry screen rather than disclose content.
- Terminate and relaunch the app within the same phone session. Confirm it still opens successfully. This alone does **not** prove that the exact device ID persisted: the shell does not expose identity or allow a tree to be selected. Record persistence as unverified until an observable tree/session survives restart or an authorized native storage inspection compares the ID.
- Do not treat a fresh Revyl session as a persistence test; session replacement discards app data.

## Integrated ritual

Use at least three distinct identities and two trees. Give each test its actions, observed result, evidence, and pass/fail/untested status. A visible UI restriction does not establish server-side privacy: also exercise the underlying query with an ineligible identity.

| Area | Required observations |
| --- | --- |
| Membership | Create one tree, join it by its six-character code from a second identity, reject invalid codes, and restore the selected tree after app termination/relaunch. |
| Answers | Submit once, observe one new blossom, reject a second submission, and preserve the first answer. |
| Participation and bloom privacy | Before answering and before bloom, query with eligible/ineligible identities. Never disclose another person's answer until both participation and bloom gates permit it. |
| Bloom timing | Verify both everyone-answered bloom and deadline bloom; confirm answers become readable only at the permitted point. |
| Notes | Send a private note. Only sender and answer author may read it; a third identity must not see the note through UI or query. |
| Grove | Show a past answered day and a missed day as a bare sapling. |
| Kindred | After bloom, show three answers from other trees with one-line reasons; do not accept same-tree matches. Record stub versus model judging. |
| Demo replay | Run a complete compressed day in about one minute, restart it, and prove old scheduled jobs cannot bloom or judge the new run. |
| Sandbox lantern | Open sandbox checkout, cancel it without lighting a lantern, then use the sandbox test card. A lantern becomes paid only after a verified webhook record, never on browser close. Check the cause total and duplicate-webhook idempotency. |

Stop and route failures to the owning crew through the Captain; QA does not repair shared app, package, design, or backend files. Preserve screenshots or recordings with the build/device/SHA and describe outcomes in plain English. Leave unimplemented or blocked flows explicitly untested.
