import type { ModelTier } from './types.js';

export interface TierModels {
  top: string;
  mid: string;
  cheap: string;
}

export const DEFAULT_TIER_MODELS: TierModels = { top: 'opus', mid: 'sonnet', cheap: 'haiku' };

export interface ModelPolicy {
  /** `taskModel` (an order-only `orderModel`, a per-POST `body.model`) overrides the tier default. */
  resolve(tier: ModelTier, opts?: { taskModel?: string }): string;
}

export function createModelPolicy(overrides?: Partial<TierModels>): ModelPolicy {
  const tiers: TierModels = { ...DEFAULT_TIER_MODELS, ...overrides };
  return {
    resolve(tier, opts) {
      if (tier === 'none') {
        throw new Error("ModelPolicy cannot resolve tier 'none' — a script task must never invoke a model");
      }
      return opts?.taskModel ?? tiers[tier];
    },
  };
}
