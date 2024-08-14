import { zValidator } from '@hono/zod-validator'
import {
  LogSources,
  runDocumentAtCommit,
  streamToGenerator,
} from '@latitude-data/core'
import { queues } from '$/jobs'
import { Factory } from 'hono/factory'
import { SSEStreamingApi, streamSSE } from 'hono/streaming'
import { z } from 'zod'

import { getData } from './_shared'

const factory = new Factory()

const runSchema = z.object({
  documentPath: z.string(),
  parameters: z.record(z.any()).optional().default({}),
})

export const runHandler = factory.createHandlers(
  zValidator('json', runSchema),
  async (c) => {
    return streamSSE(c, async (stream) => {
      const startTime = Date.now()

      const { projectId, commitUuid } = c.req.param()
      const { documentPath, parameters } = c.req.valid('json')

      const workspace = c.get('workspace')
      const apiKey = c.get('apiKey')

      const { document, commit, project } = await getData({
        workspace,
        projectId: Number(projectId!),
        commitUuid: commitUuid!,
        documentPath: documentPath!,
      })

      const result = await runDocumentAtCommit({
        workspaceId: project.workspaceId,
        document,
        commit,
        parameters,
        providerLogHandler: (log) => {
          queues.defaultQueue.jobs.enqueueCreateProviderLogJob({
            ...log,
            source: LogSources.API,
            apiKeyId: apiKey.id,
          })
        },
      }).then((r) => r.unwrap())

      await pipeToStream(stream, result.stream)

      queues.defaultQueue.jobs.enqueueCreateDocumentLogJob({
        commit,
        data: {
          uuid: result.documentLogUuid,
          documentUuid: document.documentUuid,
          resolvedContent: result.resolvedContent,
          parameters,
          duration: Date.now() - startTime,
        },
      })
    })
  },
)

async function pipeToStream(
  stream: SSEStreamingApi,
  readableStream: ReadableStream,
) {
  let id = 0
  for await (const value of streamToGenerator(readableStream)) {
    stream.writeln(
      JSON.stringify({
        ...value,
        id: String(id++),
      }),
    )
  }
}
