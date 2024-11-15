import type { ContentType, Message, MessageRole } from '@latitude-data/compiler'
import { DocumentLog, type ChainEventDto } from '@latitude-data/core/browser'
import { EvaluationResultDto } from '@latitude-data/core/repositories'
import env from '$sdk/env'
import { GatewayApiConfig, RouteResolver } from '$sdk/utils'
import {
  ApiErrorCodes,
  ApiErrorJsonResponse,
  LatitudeApiError,
} from '$sdk/utils/errors'
import { makeRequest } from '$sdk/utils/request'
import { streamChat } from '$sdk/utils/streamChat'
import { streamRun } from '$sdk/utils/streamRun'
import { syncChat } from '$sdk/utils/syncChat'
import { syncRun } from '$sdk/utils/syncRun'
import {
  ChatOptions,
  EvalOptions,
  GetOrCreatePromptOptions,
  GetPromptOptions,
  HandlerType,
  LogSources,
  Prompt,
  RunPromptOptions,
  SDKOptions,
  StreamChainResponse,
} from '$sdk/utils/types'

const WAIT_IN_MS_BEFORE_RETRY = 1000
const DEFAULT_GAWATE_WAY = {
  host: env.GATEWAY_HOSTNAME,
  port: env.GATEWAY_PORT,
  ssl: env.GATEWAY_SSL,
}
const DEFAULT_INTERNAL = {
  source: LogSources.API,
  retryMs: WAIT_IN_MS_BEFORE_RETRY,
}

type Options = {
  versionUuid?: string
  projectId?: number
  gateway?: GatewayApiConfig
  __internal?: { source?: LogSources; retryMs?: number }
}

class Latitude {
  protected options: SDKOptions

  public evaluations: {
    trigger: (uuid: string, options?: EvalOptions) => Promise<{ uuid: string }>
    createResult: (
      uuid: string,
      evaluationUuid: string,
      options: { result: string | boolean | number; reason: string },
    ) => Promise<{ uuid: string }>
  }

  public logs: {
    create: (
      path: string,
      messages: Message[],
      options?: {
        projectId?: number
        versionUuid?: string
        response?: string
      },
    ) => Promise<DocumentLog>
  }

  public prompts: {
    get: (path: string, args: GetPromptOptions) => Promise<Prompt>
    getOrCreate: (
      path: string,
      args: GetOrCreatePromptOptions,
    ) => Promise<Prompt>
    run: (path: string, args: RunPromptOptions) => Promise<any>
    chat: (
      uuid: string,
      messages: Message[],
      args?: Omit<ChatOptions, 'messages'>,
    ) => Promise<StreamChainResponse | undefined>
  }

  constructor(
    apiKey: string,
    {
      projectId,
      versionUuid,
      gateway = DEFAULT_GAWATE_WAY,
      __internal,
    }: Options = {
      gateway: DEFAULT_GAWATE_WAY,
    },
  ) {
    const { source, retryMs } = { ...DEFAULT_INTERNAL, ...__internal }
    this.options = {
      apiKey,
      retryMs,
      source,
      versionUuid,
      projectId,
      routeResolver: new RouteResolver({
        gateway,
        apiVersion: 'v2',
      }),
    }

    // Initialize evaluations namespace
    this.evaluations = {
      trigger: this.triggerEvaluation.bind(this),
      createResult: this.createResult.bind(this),
    }

    // Initialize logs namespace
    this.logs = {
      create: this.createLog.bind(this),
    }

    // Initialize prompts namespace
    this.prompts = {
      get: this.getPrompt.bind(this),
      getOrCreate: this.getOrCreatePrompt.bind(this),
      run: this.runPrompt.bind(this),
      chat: this.chat.bind(this),
    }
  }

  async getPrompt(
    path: string,
    { projectId, versionUuid }: GetPromptOptions = {},
  ) {
    projectId = projectId ?? this.options.projectId
    if (!projectId) {
      throw new Error('Project ID is required')
    }
    versionUuid = versionUuid ?? this.options.versionUuid

    const response = await makeRequest({
      method: 'GET',
      handler: HandlerType.GetDocument,
      params: { projectId, versionUuid, path },
      options: this.options,
    })

    if (!response.ok) {
      const json = (await response.json()) as ApiErrorJsonResponse
      json.errorCode
      throw new LatitudeApiError({
        status: response.status,
        message: response.statusText,
        serverResponse: JSON.stringify(json),
        errorCode: json.errorCode,
      })
    }

    return (await response.json()) as Prompt
  }

  async getOrCreatePrompt(
    path: string,
    { projectId, versionUuid, prompt }: GetOrCreatePromptOptions = {},
  ) {
    projectId = projectId ?? this.options.projectId
    if (!projectId) {
      throw new Error('Project ID is required')
    }
    versionUuid = versionUuid ?? this.options.versionUuid

    const response = await makeRequest({
      method: 'POST',
      handler: HandlerType.GetOrCreateDocument,
      params: { projectId, versionUuid },
      options: this.options,
      body: { path, prompt },
    })

    if (!response.ok) {
      const json = (await response.json()) as ApiErrorJsonResponse
      json.errorCode
      throw new LatitudeApiError({
        status: response.status,
        message: response.statusText,
        serverResponse: JSON.stringify(json),
        errorCode: json.errorCode,
      })
    }

    return (await response.json()) as Prompt
  }

  private async runPrompt(path: string, args: RunPromptOptions) {
    const options = { ...args, options: this.options }

    if (args.stream) return streamRun(path, options)
    return syncRun(path, options)
  }

  private async createLog(
    path: string,
    messages: Message[],
    {
      response,
      projectId,
      versionUuid,
    }: {
      projectId?: number
      versionUuid?: string
      response?: string
    } = {},
  ) {
    projectId = projectId ?? this.options.projectId
    if (!projectId) {
      throw new Error('Project ID is required')
    }
    versionUuid = versionUuid ?? this.options.versionUuid

    const httpResponse = await makeRequest({
      method: 'POST',
      handler: HandlerType.Log,
      params: { projectId, versionUuid },
      body: { path, messages, response },
      options: this.options,
    })

    if (!httpResponse.ok) {
      throw new LatitudeApiError({
        status: httpResponse.status,
        message: httpResponse.statusText,
        serverResponse: await httpResponse.text(),
        errorCode: ApiErrorCodes.HTTPException,
      })
    }

    return (await httpResponse.json()) as DocumentLog
  }

  private async chat(
    uuid: string,
    messages: Message[],
    args?: Omit<ChatOptions, 'messages'>,
  ) {
    // Note: Args is optional and messages is omitted to maintain backwards compatibility
    const options = { ...(args || {}), messages, options: this.options }

    if (args?.stream) return streamChat(uuid, options)
    return syncChat(uuid, options)
  }

  private async triggerEvaluation(uuid: string, options: EvalOptions = {}) {
    const response = await makeRequest({
      method: 'POST',
      handler: HandlerType.Evaluate,
      params: { conversationUuid: uuid },
      body: { evaluationUuids: options.evaluationUuids },
      options: this.options,
    })

    if (!response.ok) {
      const json = (await response.json()) as ApiErrorJsonResponse
      throw new LatitudeApiError({
        status: response.status,
        serverResponse: JSON.stringify(json),
        message: json.message,
        errorCode: json.errorCode,
        dbErrorRef: json.dbErrorRef,
      })
    }

    return (await response.json()) as { uuid: string }
  }

  private async createResult(
    uuid: string,
    evaluationUuid: string,
    {
      result,
      reason,
    }: {
      result: string | boolean | number
      reason: string
    },
  ) {
    const response = await makeRequest({
      method: 'POST',
      handler: HandlerType.EvaluationResult,
      params: {
        conversationUuid: uuid,
        evaluationUuid,
      },
      body: {
        result,
        reason,
      },
      options: this.options,
    })

    if (!response.ok) {
      const json = (await response.json()) as ApiErrorJsonResponse
      throw new LatitudeApiError({
        status: response.status,
        serverResponse: JSON.stringify(json),
        message: json.message,
        errorCode: json.errorCode,
        dbErrorRef: json.dbErrorRef,
      })
    }

    return (await response.json()) as EvaluationResultDto
  }
}

export { Latitude, LatitudeApiError, LogSources }

export type {
  ChainEventDto,
  ContentType,
  Message,
  MessageRole,
  Options,
  StreamChainResponse,
}
