import {
  ApiErrorCodes,
  ApiErrorJsonResponse,
  LatitudeErrorCodes,
} from '@latitude-data/constants/errors'
import { LatitudeApiError } from '$sdk/utils/errors'
import { makeRequest } from '$sdk/utils/request'
import {
  HandlerType,
  RunOptions,
  RunSyncAPIResponse,
  SDKOptions,
} from '$sdk/utils/types'

export async function syncRun(
  path: string,
  {
    projectId,
    versionUuid,
    parameters,
    customIdentifier,
    onFinished,
    onError,
    options,
  }: RunOptions & {
    options: SDKOptions
  },
) {
  projectId = projectId ?? options.projectId

  if (!projectId) {
    const error = new LatitudeApiError({
      status: 404,
      message: 'Project ID is required',
      serverResponse: 'Project ID is required',
      errorCode: LatitudeErrorCodes.NotFoundError,
    })
    onError?.(error)
    return Promise.reject(error)
  }

  versionUuid = versionUuid ?? options.versionUuid

  const response = await makeRequest({
    method: 'POST',
    handler: HandlerType.RunDocument,
    params: { projectId, versionUuid },
    options,
    body: {
      stream: false,
      path,
      parameters,
      customIdentifier,
    },
  })

  if (!response.ok) {
    let json: ApiErrorJsonResponse | undefined
    try {
      json = (await response.json()) as ApiErrorJsonResponse
    } catch (error) {
      // Do nothing, sometimes gateway returns html instead of json (502/504 errors)
    }

    const error = new LatitudeApiError({
      status: response.status,
      serverResponse: json ? JSON.stringify(json) : response.statusText,
      message: json?.message ?? response.statusText,
      errorCode: json?.errorCode ?? ApiErrorCodes.InternalServerError,
      dbErrorRef: json?.dbErrorRef,
    })

    onError?.(error)
    return !onError ? Promise.reject(error) : Promise.resolve(undefined)
  }

  const json = (await response.json()) as RunSyncAPIResponse
  onFinished?.(json)
  return Promise.resolve(json)
}
