import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval('cleanup incomplete sessions', { hours: 1 }, internal.cleanup.cleanupIncompleteSessions, {})

export default crons
