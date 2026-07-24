// Single source of truth for tier ordering. Imported by config, feature-gate,
// and module-loader so tier logic never drifts between modules.

export const TIERS = ['free', 'premium', 'pro'];

export const TIER_RANK = { free: 0, premium: 1, pro: 2 };

/** Numeric rank for a tier name; unknown tiers rank as free (0). */
export function tierRank(tier) {
  return TIER_RANK[tier] ?? 0;
}

/** True if `have` tier is at least `need` tier. */
export function tierSatisfies(have, need) {
  return tierRank(have) >= tierRank(need);
}
