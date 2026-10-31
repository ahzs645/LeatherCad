/* Bootstrap server builders matching Convex codegen; regenerate with `convex codegen`. */
import { queryGeneric, mutationGeneric } from 'convex/server'
import type { QueryBuilder, MutationBuilder, GenericQueryCtx, GenericMutationCtx } from 'convex/server'
import type { DataModel } from './dataModel'
export const query: QueryBuilder<DataModel, 'public'> = queryGeneric
export const mutation: MutationBuilder<DataModel, 'public'> = mutationGeneric
export type QueryCtx = GenericQueryCtx<DataModel>
export type MutationCtx = GenericMutationCtx<DataModel>
