import { describe, expect, it } from "vitest";
import { getTreeDataStatus } from "../src/components/tree/bridge";
import { treeDetailMessage } from "../src/services/tree-detail";

const fruits = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `payment:${index}`, golden: false }));

describe("route-owned tree availability", () => {
  it("keeps all 200 legacy bundle fruits and its payment event available", () => {
    const paid = fruits(200);
    const status = getTreeDataStatus({ fruits: paid, wateringEvent: { id: "legacy-payment", fruitId: paid[0].id, fruitIds: paid.map(f => f.id), revision: 1 } });
    expect(status).toEqual({ status: "ready", fruitCount: 200 });
    expect(treeDetailMessage(status, paid.length)).toBeNull();
  });

  it("preserves the true oversized count instead of slicing or reporting zero", () => {
    const paid = fruits(501);
    const status = getTreeDataStatus({ fruits: paid });
    expect(status).toEqual({ status: "unavailable", reason: "capacity", fruitCount: 501 });
    expect(treeDetailMessage(status, paid.length)).toContain("501 fruits");
    expect(paid).toHaveLength(501);
  });

  it("distinguishes invalid data without inventing a paid amount or zero count", () => {
    const status = getTreeDataStatus({ fruits: [{ id: "not-ascii-🌳", golden: false }] });
    expect(status.status).toBe("unavailable");
    expect(treeDetailMessage(status, 1)).toBe("Fruit detail couldn’t be loaded. Paid totals and streaks remain available.");
  });

  it("recovers on a complete supported snapshot without claiming tested phone capacity", () => {
    expect(treeDetailMessage(getTreeDataStatus({ fruits: fruits(501) }), 501)).not.toBeNull();
    expect(treeDetailMessage(getTreeDataStatus({ fruits: fruits(500) }), 500)).toBeNull();
  });
});
