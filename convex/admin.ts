import { mutation } from './_generated/server'
import { v } from 'convex/values'
import type { MutationCtx } from './_generated/server'

const gameDataTables = ['answers', 'sessionQuestions', 'sessions', 'pairAggregates', 'languageAggregates'] as const
type GameDataTable = (typeof gameDataTables)[number]

export const clearGameData = mutation({
  args: {
    adminSecret: v.string(),
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    assertAdmin(args.adminSecret)

    const batchSize = clampBatchSize(args.batchSize)
    const dryRun = args.dryRun === true
    const deleted: Record<GameDataTable, number> = {
      answers: 0,
      sessionQuestions: 0,
      sessions: 0,
      pairAggregates: 0,
      languageAggregates: 0
    }
    const scanned: Record<GameDataTable, number> = { ...deleted }
    const maybeMore: Record<GameDataTable, boolean> = {
      answers: false,
      sessionQuestions: false,
      sessions: false,
      pairAggregates: false,
      languageAggregates: false
    }

    for (const table of gameDataTables) {
      const docs = await deleteBatch(ctx, table, batchSize, dryRun)
      scanned[table] = docs
      deleted[table] = dryRun ? 0 : docs
      maybeMore[table] = docs === batchSize
    }

    return {
      dryRun,
      batchSize,
      scanned,
      deleted,
      maybeMore,
      hasMore: Object.values(maybeMore).some(Boolean),
      preservedTables: ['pairs', 'appConfig']
    }
  }
})

async function deleteBatch(ctx: MutationCtx, table: GameDataTable, batchSize: number, dryRun: boolean) {
  const docs = await ctx.db.query(table).take(batchSize)
  if (!dryRun) {
    for (const doc of docs) {
      await ctx.db.delete(doc._id)
    }
  }
  return docs.length
}

function assertAdmin(secret: string) {
  const expected = process.env.CONFIG_ADMIN_SECRET
  if (!expected || secret !== expected) {
    throw new Error('Not authorized to clear game data.')
  }
}

function clampBatchSize(value: number | undefined) {
  if (value === undefined) return 100
  return Math.max(1, Math.min(500, Math.floor(value)))
}
