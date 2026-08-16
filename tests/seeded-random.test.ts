import { describe, expect, it } from "vitest";
import { SeededRandom } from "@/lib/seeded-random";

describe("SeededRandom", () => {
  it("produces identical sequences for the same seed (reload/re-seed determinism)", () => {
    const a = new SeededRandom("campaign-1", "2026-01-01");
    const b = new SeededRandom("campaign-1", "2026-01-01");
    const seqA = Array.from({ length: 10 }, () => a.float());
    const seqB = Array.from({ length: 10 }, () => b.float());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = new SeededRandom("campaign-1", "2026-01-01");
    const b = new SeededRandom("campaign-2", "2026-01-01");
    expect(a.float()).not.toBe(b.float());
  });

  it("int() stays within the requested inclusive bounds", () => {
    const rand = new SeededRandom("bounds-check");
    for (let i = 0; i < 200; i++) {
      const value = rand.int(5, 9);
      expect(value).toBeGreaterThanOrEqual(5);
      expect(value).toBeLessThanOrEqual(9);
    }
  });

  it("bool() respects an extreme probability", () => {
    const rand = new SeededRandom("bool-check");
    const results = Array.from({ length: 200 }, () => rand.bool(0));
    expect(results.every((r) => r === false)).toBe(true);
  });
});
