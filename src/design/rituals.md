# Quiet streak and personal Grove integration

The charity-day presentation extension, exact bundle controls, and newer frozen DTO semantics are documented in `charity.md`. Giving is the primary Today indicator; answer history remains secondary. ViewerFruit.paidAt now accepts number or null without discarding supplied historical fruit.

These exports extend the visual kit. They do not derive streaks, schedule notifications, create checkouts, or own a data provider. The frozen backend contract is `handoffs/CONS-11/api.md` in project Drive. Use the server's 06:00 UTC ritual clock; no local/midnight arithmetic belongs here.

## Summary and Grove

Import `TodayStreaks`, `GroveGivingSummary`, `GivingFeedback`, and their types from `@/design`. Both summary components accept `summary: RitualSummary | null` and optional `color`. Null renders loading copy, not a zero streak. Pass paper explicitly on dark panels or over the night tree; do not add StoryScreen padding/scrims around the full-bleed canvas.

`RitualSummary` matches the agreed DTO:

```ts
{
  clock: { date, opensAt, nextBoundaryAt, now },
  answer: { count, status },
  giving: { count, status, longest, totalCents },
  currency: 'USD',
  isDemo,
  undatedPaidCount,
}
```

Status is `current | at_risk | none`. TodayStreaks displays the supplied count; `at_risk` retains that count and quietly says “Continue today.” It never calls yesterday-only activity broken. Summary reloads/count changes do not trigger payment feedback. Build owns refreshing at `clock.nextBoundaryAt` and deriving dates across memberships.

GroveGivingSummary shows supplied personal `giving.longest` and `giving.totalCents`. It formats exact safe-integer USD cents, including legacy amounts, and refuses invalid amounts or unsupported currency instead of guessing. It does not choose a charge, minimum, or increment. Pricing/checkout controls stay with Build. If `undatedPaidCount > 0`, the total carries a quiet explanation: those confirmed payments await a verified date and do not prove streak activity or dated fruit. `isDemo` labels sample history/totals as synthetic rather than real money.

`GroveThumbnail` adds optional `personalFruits: readonly ViewerFruit[]` and `isDemo`. Pass the viewer-only `days.grove` fruit projection for that tree/day:

```ts
{ fruitId, date, golden, milestone, isMine, source, paidAt }
```

`source` is `whop | demo`; milestone is `3 | 7 | 30 | null`. Golden appearance and milestone descriptions come only from those supplied historical fields, never today's giving count. Non-viewer fruit is not displayed. Demo source is labeled even if a caller omits isDemo. A missed-answer sapling can still carry the viewer's paid fruit. The thumbnail paints at most six static fruit marks and reports the full supplied viewer-fruit count/descriptions; it adds no WebView, money inference, or derived day counters.

## Text-only confirmation feedback

```tsx
<GivingFeedback
  baselineId={baselineId}
  event={givingTextEvent}
  onConsumed={acknowledgeGivingText}
  color={theme.paper}
/>
```

Props are `baselineId: string | null`, `event: { id, baselineId, givingCount, isDemo } | null`, `onConsumed(id): void`, and optional `color`. Mount one active text-feedback slot near app-owned Bloom controls. The component reserves a small line, politely announces the confirmed supplied count, and fades it after about 3.5 seconds; reduced motion uses immediate visibility changes. It never takes focus or opens a dialog.

Build silently establishes a fresh in-memory baseline on first snapshot/reload/context switch/demo seed/reset. A **new** verified canonical ledger ID after that baseline can emit an event. Null or mismatched baselines are ignored. Event identity is the opaque ledger ID, never provider payment ID, revision, paid count, summary count, browser return, or a UI timestamp. Multiple real confirmations on one date may each carry the same authoritative giving count. Invalid/nonpositive counts do not present a false streak.

The component dedupes IDs within its mounted baseline session, snapshots an accepted notice, and calls onConsumed when text presentation begins. Clearing event after acknowledgement does not erase the already-started notice. Build owns cross-route/live-context dedupe, active-slot routing, and immutable fan-out: text acknowledgement **must not revoke Tree's independent watering dispatch**. Local event state does not persist a bearer identity or payment queue. Changing baseline clears old feedback; a late old-context event cannot display.

For the approved demo, prior three synthetic ritual days establish an at-risk count of three without confirmation notices. Only the next explicit server-confirmed demoWater action emits a demo-labeled four-day notice. No synthetic money becomes a real personal total.

## Verification boundary

Pure presentation tests cover status copy, canonical ID/baseline guards, immutable fan-out, duplicate revisions, same-day repeated confirmations, exact USD totals, invalid money, and historical milestone copy. Browser interaction/render evidence is recorded with the PR. Native screen-reader delivery, keyboard behavior, and physical-device performance require integrated QA; source support is not proof of those outcomes.
