/**
 * Deterministic pseudo-random generation. All mock data engines must go
 * through this instead of Math.random() so that reloading a page (or
 * re-running the seed script) produces byte-identical historical numbers.
 * Seed by stable identifiers (appId, campaignId, an ISO date string, ...).
 */

// cyrb53 string hash: https://stackoverflow.com/a/52171480 (public domain algorithm)
function hashString(str: string): number {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// mulberry32 PRNG: small, fast, good-enough statistical quality for mock data.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SeededRandom {
  private rand: () => number;

  constructor(...seedParts: (string | number)[]) {
    const seedStr = seedParts.join("::");
    this.rand = mulberry32(hashString(seedStr) % 2 ** 31);
  }

  /** Uniform float in [min, max). */
  float(min = 0, max = 1): number {
    return min + this.rand() * (max - min);
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1));
  }

  /** Roughly-normal float via averaging (Irwin-Hall approximation), clamped to [min, max]. */
  normal(mean: number, stdDev: number, min?: number, max?: number): number {
    let sum = 0;
    for (let i = 0; i < 6; i++) sum += this.rand();
    const value = mean + (sum - 3) * stdDev;
    if (min !== undefined && value < min) return min;
    if (max !== undefined && value > max) return max;
    return value;
  }

  bool(probability = 0.5): boolean {
    return this.rand() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }
}
