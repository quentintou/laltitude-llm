import { InferSelectModel, relations } from 'drizzle-orm'
import { bigint, bigserial, index, varchar } from 'drizzle-orm/pg-core'

import { latitudeSchema, workspaces } from '..'
import { timestamps } from '../schemaHelpers'

export const projects = latitudeSchema.table(
  'projects',
  {
    id: bigserial('id', { mode: 'number' }).notNull().primaryKey(),
    name: varchar('name', { length: 256 }).notNull(),
    workspaceId: bigint('workspace_id', { mode: 'number' })
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    ...timestamps(),
  },
  (table) => ({
    nextCommitIdx: index('workspace_idx').on(table.workspaceId),
  }),
)

export const projectRelations = relations(projects, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
}))

export type Project = InferSelectModel<typeof projects>
