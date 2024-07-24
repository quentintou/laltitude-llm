import {
  database,
  projects,
  Result,
  Transaction,
  type Project,
} from '@latitude-data/core'
import { createCommit } from '$core/services/commits/create'

export async function createProject(
  {
    workspaceId,
    name = 'First Project',
  }: {
    workspaceId: number
    name?: string
  },
  db = database,
) {
  return Transaction.call<Project>(async (tx) => {
    const project = (
      await tx.insert(projects).values({ workspaceId, name }).returning()
    )[0]!
    const commit = await createCommit({
      commit: {
        projectId: project.id,
        title: 'Initial version',
        mergedAt: new Date(),
      },
      db: tx,
    })

    if (commit.error) return commit

    return Result.ok(project)
  }, db)
}
