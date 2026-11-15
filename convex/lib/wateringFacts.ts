import type { Doc } from "../_generated/dataModel";

export function bundleCount(row: Doc<"lanterns">) {
  if (row.bundles !== undefined) {
    return Number.isSafeInteger(row.bundles) && row.bundles > 0 && row.bundles * 50 === row.amountCents ? row.bundles : 0;
  }
  if (row.source !== "demo" && !row.whopPaymentId) return 0;
  return Number.isSafeInteger(row.amountCents) && row.amountCents > 0 && row.amountCents % 50 === 0 ? row.amountCents / 50 : 0;
}

export function hasCreditedDate(row: Doc<"lanterns">) {
  return !!row.creditedDate && (row.paidAt !== undefined || (row.attribution === "checkout_day" && !!row.dayId));
}

export function paidForDay(row: Doc<"lanterns">, day: Doc<"days">) {
  if (row.status !== "paid") return false;
  if (day.isDemo ? row.demoRunId !== day.demoRunId : row.source === "demo") return false;
  if (row.dayId) return row.dayId === day._id;
  return hasCreditedDate(row) && row.creditedDate === (day.ritualDate ?? day.date);
}
