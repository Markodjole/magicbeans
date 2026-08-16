import { describe, expect, it } from "vitest";
import { computeProjection } from "@/lib/engine/projection";

describe("computeProjection", () => {
  it("base case extrapolates spend * historical ROAS directly", () => {
    const result = computeProjection({ spendAmount: 10000, historicalROAS: 1.87 });
    expect(result.baseRevenue).toBe(18700);
  });

  it("bear is below base and bull is above base", () => {
    const result = computeProjection({ spendAmount: 10000, historicalROAS: 1.87 });
    expect(result.bearRevenue).toBeLessThan(result.baseRevenue);
    expect(result.bullRevenue).toBeGreaterThan(result.baseRevenue);
  });

  it("never produces a negative scenario for positive inputs", () => {
    const result = computeProjection({ spendAmount: 10000, historicalROAS: 1.87 });
    expect(result.bearRevenue).toBeGreaterThan(0);
  });
});
