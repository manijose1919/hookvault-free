import { tierRank, tierSatisfies } from './tiers.js';

// The single seam between the free core and paid modules.
//
// A feature is "available" only when BOTH conditions hold:
//   1. The configured tier is licensed for it (tierSatisfies), AND
//   2. The module that implements it is physically loaded.
//
// In the public/free build the paid module folders don't exist, so their
// features can never be loaded -> `has()` is always false -> core falls back
// to free behavior. This makes it impossible to ship or reverse-engineer paid
// code out of the open build.

export const FEATURES = {
  // Premium
  'premium.backoff': 'premium',
  'premium.dlq': 'premium',
  'premium.replay': 'premium',
  'premium.search': 'premium',
  'premium.key_rotation': 'premium',
  'premium.alerting': 'premium',
  'premium.api_auth': 'premium',
  // Pro
  'pro.workspaces': 'pro',
  'pro.rbac': 'pro',
  'pro.transform': 'pro',
  'pro.sla': 'pro',
  'pro.audit': 'pro',
  'pro.export': 'pro',
};

export function createFeatureGate(tier, loadedFeatures = new Set()) {
  const rank = tierRank(tier);
  return {
    tier,
    rank,
    /** True only if licensed AND the implementing module is loaded. */
    has(feature) {
      const required = FEATURES[feature];
      if (!required) return false;
      return tierSatisfies(tier, required) && loadedFeatures.has(feature);
    },
    /** True if the tier alone would permit this feature (ignores module presence). */
    licensedFor(feature) {
      const required = FEATURES[feature];
      return required ? tierSatisfies(tier, required) : false;
    },
    /** Snapshot of everything actually active, for /health and dashboards. */
    activeFeatures() {
      return Object.keys(FEATURES).filter((f) => this.has(f));
    },
  };
}
