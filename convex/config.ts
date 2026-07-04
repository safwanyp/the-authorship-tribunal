import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { v } from 'convex/values'

const configKey = 'global'
const language = v.union(v.literal('js'), v.literal('ts'), v.literal('python'), v.literal('rust'), v.literal('cpp'))
const configPatch = {
  enabledLanguages: v.optional(v.array(language)),
  datasetVersion: v.optional(v.string()),
  totalQuestions: v.optional(v.number()),
  resumeMs: v.optional(v.number()),
  enableDemographicPrompts: v.optional(v.boolean()),
  enablePairReporting: v.optional(v.boolean()),
  enablePublicAggregates: v.optional(v.boolean()),
  enablePercentiles: v.optional(v.boolean()),
  enableShareCard: v.optional(v.boolean())
}

export type Language = 'js' | 'ts' | 'python' | 'rust' | 'cpp'

export interface AppConfig {
  enabledLanguages: Language[]
  datasetVersion: string
  totalQuestions: number
  resumeMs: number
  enableDemographicPrompts: boolean
  enablePairReporting: boolean
  enablePublicAggregates: boolean
  enablePercentiles: boolean
  enableShareCard: boolean
}

const defaultAppConfig: AppConfig = {
  enabledLanguages: ['js'],
  datasetVersion: 'v1',
  totalQuestions: 10,
  resumeMs: 5 * 60 * 1000,
  enableDemographicPrompts: false,
  enablePairReporting: false,
  enablePublicAggregates: true,
  enablePercentiles: false,
  enableShareCard: true
}

export const getAppConfig = query({
  args: {},
  handler: async (ctx) => readAppConfig(ctx)
})

export const updateAppConfig = mutation({
  args: {
    adminSecret: v.string(),
    ...configPatch
  },
  handler: async (ctx, args) => {
    const expectedSecret = process.env.CONFIG_ADMIN_SECRET
    if (!expectedSecret || args.adminSecret !== expectedSecret) {
      throw new Error('Not authorized to update app config.')
    }

    const existing = await ctx.db.query('appConfig').withIndex('by_key', (q) => q.eq('key', configKey)).unique()
    const patch = compactPatch(args)
    const now = Date.now()

    if (!existing) {
      await ctx.db.insert('appConfig', {
        key: configKey,
        ...defaultAppConfig,
        ...patch,
        updatedAt: now
      })
    } else {
      await ctx.db.patch(existing._id, {
        ...patch,
        updatedAt: now
      })
    }

    return readAppConfig(ctx)
  }
})

export async function readAppConfig(ctx: QueryCtx | MutationCtx): Promise<AppConfig> {
  const row = await ctx.db.query('appConfig').withIndex('by_key', (q) => q.eq('key', configKey)).unique()
  if (!row) return defaultAppConfig

  return {
    enabledLanguages: row.enabledLanguages,
    datasetVersion: row.datasetVersion,
    totalQuestions: row.totalQuestions,
    resumeMs: row.resumeMs,
    enableDemographicPrompts: row.enableDemographicPrompts,
    enablePairReporting: row.enablePairReporting,
    enablePublicAggregates: row.enablePublicAggregates,
    enablePercentiles: row.enablePercentiles,
    enableShareCard: row.enableShareCard
  }
}

function compactPatch(args: Partial<AppConfig>) {
  const patch: Partial<AppConfig> = {}
  if (args.enabledLanguages !== undefined) patch.enabledLanguages = args.enabledLanguages
  if (args.datasetVersion !== undefined) patch.datasetVersion = args.datasetVersion
  if (args.totalQuestions !== undefined) patch.totalQuestions = args.totalQuestions
  if (args.resumeMs !== undefined) patch.resumeMs = args.resumeMs
  if (args.enableDemographicPrompts !== undefined) patch.enableDemographicPrompts = args.enableDemographicPrompts
  if (args.enablePairReporting !== undefined) patch.enablePairReporting = args.enablePairReporting
  if (args.enablePublicAggregates !== undefined) patch.enablePublicAggregates = args.enablePublicAggregates
  if (args.enablePercentiles !== undefined) patch.enablePercentiles = args.enablePercentiles
  if (args.enableShareCard !== undefined) patch.enableShareCard = args.enableShareCard
  return patch
}
