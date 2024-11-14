import { OpenAPIHono } from '@hono/zod-openapi'
import { getHandler } from '$/routes/api/v1/projects/[projectId]/versions/[versionUuid]/documents/handlers/get'

import { runHandler } from './handlers/run'
import { logsRouterV2 } from './logs'

const router = new OpenAPIHono()

router.get('/:documentPath{.+}', ...getHandler)
router.route('/logs', logsRouterV2)
router.route('/run', runHandler)

export { router as documentsRouter }
