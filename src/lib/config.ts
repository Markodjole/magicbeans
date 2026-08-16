/**
 * Central place for environment-driven feature flags. Never read
 * process.env directly for these outside this file, so the real-money
 * kill switch can't be bypassed by a typo somewhere else in the app.
 */

export const ENABLE_REAL_MONEY = process.env.ENABLE_REAL_MONEY === "true";

/**
 * Only HIGH and MEDIUM confidence attribution counts toward investor
 * revenue share by default. Configurable per the spec's "make this
 * configurable" requirement — change here to include LOW.
 */
export const ELIGIBLE_ATTRIBUTION_CONFIDENCES = ["HIGH", "MEDIUM"] as const;

export const PLATFORM_FEE_PERCENT = 0; // no platform fee taken in this prototype
