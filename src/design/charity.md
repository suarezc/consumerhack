# Charity-day shared presentation

These `@/design` exports consume the frozen Build facts in project Drive `handoffs/CONS-11/charity-api.md`. That document is an implementation target, not proof of backend deployment. No component owns navigation, checkout, answer authorization, first-open acknowledgement, totals, distinct-person counts, or payment confirmation.

## Today and watering

The final product layout uses `ProductScene({tree,meta,title,detail?,underQuestion?,children?,onOpenTree?,overlay?})`. Pass the existing actual Tree as a full-size ReactNode, quiet summary/giving under the question, and exactly one contextual hill action in children: `Leave your answer` before answering, the exact watering CTA after answering. `productSceneStyles.primary/secondary/secondaryLabel` give the cream primary and discreet Grove treatment. Settings and an explicitly named demo panel belong behind More; no equal-pill navigation/debug toolbar belongs on the hill. The shared frame does not count, truncate or alter supplied fruit, so route-owned large-tree fallback content remains authoritative.

`ProductSheet({title,onClose,children,open?=true,onShow?})` is the shared bottom-sheet surface with keyboard avoidance, scroll containment, reduced-motion behavior and a top close target. Build's Panel can be a thin adapter. The answer field/submission and payment state/retry identity remain controlled by the screen. The product foreground scrolls when content exceeds the safe viewport, leaving the actual full-bleed canvas untouched; blank scene space passes through to the Tree. Use `theme.text` for caller-owned header text, not the raw interpolated theme.ink. A local header-only contrast backing is intentional around dusk, with an opaque reading surface for unusually tall headers; it is not a global scene scrim.

TodayCharitySummary is now a transparent, compact under-question line by default, not a dark card. Its running total is separate accessible text, not hidden inside the charity button name. Use `TodayStreaks compact` for the fruit/giving line; the full presentation retains secondary answer history. WateringBundles is an unboxed sheet interior, never a second scene toolbar.

`TodayCharitySummary({charity, totalRaisedCents, isDemo, onShowDetails, error?})` shows the daily charity and gross paid total. `charity` and `totalRaisedCents` independently accept null for loading; a known zero displays `$0.00`. Use **today.totalRaisedCents**, never tree-wide `raisedCents`/`lanternCount` or the viewer's all-time `streaks.giving.totalCents`. Errors do not display a stale total as current.

`CharityDetails({charity, onOpenLink})` presents `{name,theme,description,link,programs:string[]}` and delegates the supplied official URL to the screen. Today can open this shared presentation using onShowDetails; Yesterday includes it below the Today action.

```tsx
<WateringBundles
  selectedBundles={bundles}
  onSelectBundles={setBundles}
  onWater={startWatering}
  canWater={canWater}
  loading={openingCheckout}
  error={checkoutError}
  isDemo={today.streaks.isDemo}
/>
```

Selection is controlled and typed `2 | 5 | 10`, with fixed display labels `$1 / $2.50 / $5`. These are gross preset prices, not net proceeds. The callback receives only bundles, never a client-authoritative amount. Only the server creates/authorizes a checkout. Selection and submission disable while loading or unable to water; the component exposes selected, disabled, busy, and error semantics. The exact CTA is `Water today's tree for S.A.C.K.`. An invalid runtime selection cannot enable submission.

`canWater` comes from Build's answer/authorization contract, **not bloom state**. Once the viewer has answered, watering is available before or after bloom. The screen owns pending state and retry identity. Starting or returning from checkout does not add fruit, change money/streaks, or emit GivingFeedback. Visible copy distinguishes synthetic demo waterings and the sandbox example account; it asserts no real charity payout or 100% net proceeds.

## Yesterday

`YesterdayImpact({impact, onToday, onOpenLink, children?, error?, color?})` accepts the server Yesterday DTO structurally: it reads only `charity,totalRaisedCents,answererCount,watererCount,myGivenCents,isDemo`. Public counts are unique people, never payments, members or fruit. `impact:null` renders loading rather than zero; a known zero total/count remains zero. Withheld/null/zero/invalid private cents do not render “You gave”; a positive server-authorized amount does. This component never infers a viewer's amount from public fruit or totals. Errors suppress stale impact/private amounts.

The screen passes its existing Tree in the children slot, with explicit layout sizing as needed. No second renderer or Tree contract is introduced. The component adds no outer padding or scene scrim. Preserve the reference's full-bleed tree; do not wrap Today/Bloom's canvas in StoryScreen. Build owns `days.firstOpen` routing and calls `days.acknowledgeYesterday` with the current todayDayId when onToday is accepted; presentation does neither.

## Fruit and feedback

TodayStreaks now places giving before the secondary answer indicator. Existing canonical-payment-level GivingFeedback remains unchanged: one payment event, even when its fruitIds contains five bundle fruits. Its text acknowledgement must not revoke Tree's independently consumed event.

ViewerFruit now accepts `paidAt:number|null` from the frozen Fruit contract. Grove displays supplied legitimate historical fruit even when paidAt is unknown. A historical three-bundle allocation can display three fruits, while new checkout choices remain exactly 2/5/10. No fruit is invented for nonintegral legacy money, and no timestamp/date is derived here. Golden flags and milestones remain supplied per historical day.

The prior streak/Grove/event contract and native-verification boundaries remain in `rituals.md`. Browser fixtures are presentation evidence, not real provider, first-open, payment replay, native accessibility, or integrated Tree-delivery proof.
