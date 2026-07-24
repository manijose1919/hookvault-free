import { tierRank } from './tiers.js';
import { logger } from './logger.js';

// Discovers and loads paid feature modules at boot based on the licensed tier.
//
// Each module implements the contract { register(), migrate(db), mountRoutes() }.
// If a module folder is absent (the public/free build strips them), the dynamic
// import throws ERR_MODULE_NOT_FOUND and we skip it — the core keeps running in
// free mode.
//
// Returns:
//   { features: Set<string>, modules: Array<{ name, mod }> }

const MODULE_TIERS = [
  { name: 'premium', rank: tierRank('premium') },
  { name: 'pro', rank: tierRank('pro') },
];

export async function loadModules(tier) {
  const features = new Set();
  const modules = [];
  const licensedRank = tierRank(tier);

  for (const entry of MODULE_TIERS) {
    if (entry.rank > licensedRank) continue; // not licensed for this tier

    try {
      const mod = await import(`../modules/${entry.name}/index.js`);
      const feats = typeof mod.register === 'function' ? mod.register() || [] : [];
      for (const feature of feats) features.add(feature);
      modules.push({ name: entry.name, mod });
      if (feats.length) logger.info('module_loaded', { module: entry.name, features: feats });
    } catch (err) {
      if (err.code === 'ERR_MODULE_NOT_FOUND') {
        logger.warn('module_absent', { module: entry.name });
        continue; // stripped from this build — expected in free/public builds
      }
      throw err;
    }
  }

  return { features, modules };
}

/** Run every loaded module's migrations against the db. */
export function migrateModules(modules, db) {
  for (const { mod } of modules) {
    if (typeof mod.migrate === 'function') mod.migrate(db);
  }
}
