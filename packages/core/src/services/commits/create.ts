import { Commit, Project, User } from '../../browser'
import { database, Database } from '../../client'
import { publisher } from '../../events/publisher'
import { Result, Transaction } from '../../lib'
import { commits } from '../../schema'

export async function createCommit({
  project,
  user,
  data: { title, description, mergedAt, version },
  db = database,
}: {
  project: Project
  user: User
  data: {
    title: string
    description?: string
    version?: number
    mergedAt?: Date
  }
  db?: Database
}) {
  return Transaction.call<Commit>(async ({ db: tx, sideEffects }) => {
    const result = await tx
      .insert(commits)
      .values({
        projectId: project.id,
        userId: user.id,
        title,
        description,
        version,
        mergedAt,
      })
      .returning()
    const createdCommit = result[0]

    sideEffects.push(async () => {
      publisher.publishLater({
        type: 'commitCreated',
        data: {
          commit: createdCommit!,
          userEmail: user.email,
          workspaceId: project.workspaceId,
        },
      })
    })

    return Result.ok(createdCommit!)
  }, db)
}
