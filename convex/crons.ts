import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()
crons.interval('collect unfinished cloud uploads', { hours: 1 }, internal.cloudAssetMaintenance.collectOrphans, { cursor: null })
export default crons
